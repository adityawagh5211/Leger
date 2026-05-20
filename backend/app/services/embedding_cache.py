"""
Embedding Cache — local semantic similarity cache for transaction categorization.
Uses sentence-transformers (all-MiniLM-L6-v2) for zero-cost embeddings.
Provides cosine similarity search over cached transaction descriptions.

Deployment notes
────────────────
The model (~90 MB) is downloaded from HuggingFace on first use and cached at
the path set by the TRANSFORMERS_CACHE / HF_HOME environment variables.

To disable on memory-constrained servers set:
    ENABLE_LOCAL_EMBEDDINGS=false
The pipeline then skips the embedding tier and falls through to the LLM tier.
"""

import logging
import os
import threading
from collections import OrderedDict
from typing import Any

import numpy as np

from ..config import settings

logger = logging.getLogger("ledger.embedding_cache")

# Point HuggingFace to a stable, predictable cache directory so the model
# survives container restarts when a persistent volume is mounted there.
_HF_CACHE = os.environ.get("TRANSFORMERS_CACHE") or os.environ.get("HF_HOME")
if not _HF_CACHE:
    # Default: <repo-root>/backend/.hf_cache — easy to mount as a Docker volume
    _HF_CACHE = os.path.join(os.path.dirname(__file__), "..", "..", ".hf_cache")
    os.environ["HF_HOME"] = os.path.abspath(_HF_CACHE)
    os.environ["TRANSFORMERS_CACHE"] = os.path.abspath(_HF_CACHE)


# ── Constants ────────────────────────────────────────────────────────────────
SIMILARITY_THRESHOLD = 0.80   # Minimum cosine similarity to accept a cached result
EMBEDDING_CACHE_SIZE = 2048   # Max number of description embeddings to cache


class EmbeddingCache:
    """
    Thread-safe LRU cache of description → (embedding_vector, category, confidence).
    Falls back gracefully if sentence-transformers is not installed.
    """

    def __init__(self, maxsize: int = EMBEDDING_CACHE_SIZE):
        self.maxsize        = maxsize
        self._cache: OrderedDict[str, dict] = OrderedDict()
        self._model         = None
        self._model_loaded  = False
        self._model_lock    = threading.Lock()
        self._cache_lock    = threading.Lock()
        # Respect ENABLE_LOCAL_EMBEDDINGS env flag — allows operators to disable
        # the 90 MB model on memory-constrained servers without code changes.
        self._enabled = settings.enable_local_embeddings
        if not self._enabled:
            logger.info(
                "Local embeddings disabled via ENABLE_LOCAL_EMBEDDINGS=false. "
                "Categorization will use rules + LLM only."
            )
            self._model_loaded = True  # skip _load_model() calls

    def _load_model(self):
        """Lazy-load the embedding model on first use."""
        if not self._enabled:
            return
        with self._model_lock:
            if self._model_loaded:
                return
            try:
                from sentence_transformers import SentenceTransformer
                model_name = settings.embedding_model or "all-MiniLM-L6-v2"
                logger.info("Loading embedding model: %s (cache: %s)", model_name, os.environ.get("HF_HOME", "default"))
                self._model = SentenceTransformer(model_name)
                self._model_loaded = True
                logger.info("Embedding model loaded successfully")
            except ImportError:
                logger.warning(
                    "sentence-transformers not installed. "
                    "Run: pip install sentence-transformers. "
                    "Embedding-based categorization will be skipped."
                )
                self._model_loaded = True  # Mark as loaded (with None model) to avoid retrying
            except Exception as e:
                logger.warning("Embedding model load failed: %s. Skipping embedding tier.", e)
                self._model_loaded = True

    def is_available(self) -> bool:
        """Returns True if the embedding model is available."""
        if not self._model_loaded:
            self._load_model()
        return self._model is not None

    def embed(self, text: str) -> np.ndarray | None:
        """Compute embedding vector for a text string."""
        if not self.is_available():
            return None
        try:
            vec = self._model.encode(text, normalize_embeddings=True, show_progress_bar=False)
            return vec
        except Exception as e:
            logger.warning("Failed to embed text '%s...': %s", text[:30], e)
            return None

    def embed_batch(self, texts: list[str]) -> list[np.ndarray] | None:
        """Compute embeddings for a batch of texts."""
        if not self.is_available():
            return None
        try:
            vecs = self._model.encode(texts, normalize_embeddings=True, show_progress_bar=False, batch_size=32)
            return list(vecs)
        except Exception as e:
            logger.warning("Batch embedding failed: %s", e)
            return None

    def put(self, description: str, category: str, confidence: float, merchant: str | None = None) -> None:
        """
        Store a description's embedding and its category result in the cache.
        Also stores the raw embedding vector for similarity search.
        """
        vec = self.embed(description)
        if vec is None:
            return

        key = description.lower().strip()
        entry = {
            "description": description,
            "embedding": vec,
            "category": category,
            "confidence": confidence,
            "merchant": merchant,
        }

        with self._cache_lock:
            if key in self._cache:
                self._cache.move_to_end(key)
            self._cache[key] = entry
            if len(self._cache) > self.maxsize:
                self._cache.popitem(last=False)

    def find_similar(self, description: str, threshold: float = SIMILARITY_THRESHOLD) -> dict[str, Any] | None:
        """
        Search cache for semantically similar descriptions.
        Returns the best match above threshold, or None.
        """
        if not self.is_available():
            return None

        query_vec = self.embed(description)
        if query_vec is None:
            return None

        with self._cache_lock:
            entries = list(self._cache.values())

        if not entries:
            return None

        # Stack all cached embeddings for vectorized cosine similarity
        try:
            cached_vecs = np.stack([e["embedding"] for e in entries])
            # Cosine similarity: since embeddings are normalized, dot product = cosine sim
            sims = cached_vecs @ query_vec
            best_idx = int(np.argmax(sims))
            best_sim = float(sims[best_idx])

            if best_sim >= threshold:
                match = entries[best_idx]
                logger.debug(
                    "Embedding cache hit: '%s' ~ '%s' (sim=%.3f, cat=%s)",
                    description[:40], match["description"][:40], best_sim, match["category"]
                )
                return {
                    "category": match["category"],
                    "confidence": min(match["confidence"], best_sim),  # cap by similarity
                    "merchant": match["merchant"],
                    "similarity": best_sim,
                    "source": "embedding_cache",
                }
        except Exception as e:
            logger.warning("Similarity search failed: %s", e)

        return None

    def get_stats(self) -> dict:
        """Returns cache statistics."""
        with self._cache_lock:
            return {
                "size": len(self._cache),
                "maxsize": self.maxsize,
                "model_loaded": self._model_loaded,
                "model_available": self._model is not None,
            }


# Singleton instance — shared across the application
embedding_cache = EmbeddingCache()
