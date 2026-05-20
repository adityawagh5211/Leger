# ── Stage 1: dependencies ─────────────────────────────────────────────────────
FROM python:3.12-slim AS deps

WORKDIR /app

# System deps needed by torch/sentence-transformers
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Stage 2: download & bake the embedding model ──────────────────────────────
# This runs ONCE at build time, so deployed containers never hit HuggingFace.
# The model is stored at /app/.hf_cache which matches the default path set in
# embedding_cache.py and is also mountable as a persistent volume.
FROM deps AS model-download

ENV HF_HOME=/app/.hf_cache
ENV TRANSFORMERS_CACHE=/app/.hf_cache

RUN python - <<'EOF'
from sentence_transformers import SentenceTransformer
import os
model_name = os.environ.get("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
print(f"Downloading {model_name} to {os.environ['HF_HOME']} ...")
SentenceTransformer(model_name)
print("Model download complete.")
EOF

# ── Stage 3: final runtime image ──────────────────────────────────────────────
FROM python:3.12-slim AS runtime

WORKDIR /app

# Copy installed packages from deps stage
COPY --from=deps /usr/local/lib/python3.12 /usr/local/lib/python3.12
COPY --from=deps /usr/local/bin /usr/local/bin

# Copy pre-downloaded model
COPY --from=model-download /app/.hf_cache /app/.hf_cache

# Copy application source
COPY . .

# These env vars tell HuggingFace to use the baked-in model — no network needed
ENV HF_HOME=/app/.hf_cache
ENV TRANSFORMERS_CACHE=/app/.hf_cache
ENV HF_DATASETS_OFFLINE=1
ENV TRANSFORMERS_OFFLINE=1

# Non-root user for security
RUN useradd -r -u 1001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Use 2 workers — tune via WORKERS env var for larger instances
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${WORKERS:-2}"]
