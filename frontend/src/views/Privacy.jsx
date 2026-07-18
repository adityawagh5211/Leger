import React from 'react';
import { Shield, Lock, Eye, Trash2, Mail, ArrowLeft } from 'lucide-react';
import { LedgerLogo } from '../components/ui';

const LAST_UPDATED = 'July 18, 2025';
const APP_NAME = 'Ledger';
const CONTACT_EMAIL = 'ast.movies9688@gmail.com';
const APP_URL = 'https://ledger-beta-two.vercel.app';

function Section({ icon: Icon, title, children }) {
  return (
    <section style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: '28px 32px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'var(--primary-glow)',
          border: '1px solid rgba(168,255,47,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={18} color="var(--primary)" />
        </div>
        <h2 style={{
          fontSize: 18, fontWeight: 700,
          color: 'var(--text-primary)', margin: 0,
          letterSpacing: '-0.02em',
        }}>{title}</h2>
      </div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.75 }}>
        {children}
      </div>
    </section>
  );
}

function BulletList({ items }) {
  return (
    <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, i) => (
        <li key={i} style={{ color: 'var(--text-secondary)' }}>{item}</li>
      ))}
    </ul>
  );
}

export default function Privacy() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      padding: '40px 20px 80px',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Back link */}
        <a
          href={APP_URL}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            color: 'var(--text-muted)', fontSize: 14, fontWeight: 500,
            textDecoration: 'none', marginBottom: 40,
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <ArrowLeft size={15} /> Back to {APP_NAME}
        </a>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <LedgerLogo size={52} style={{ marginBottom: 20 }} />
          <h1 style={{
            fontSize: 'clamp(28px, 5vw, 42px)',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.03em',
            margin: '16px 0 12px',
          }}>
            Privacy Policy
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
            Last updated: {LAST_UPDATED}
          </p>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: 15,
            maxWidth: 520,
            margin: '16px auto 0',
            lineHeight: 1.7,
          }}>
            {APP_NAME} is a personal AI finance platform. We take your financial
            data seriously. This policy explains exactly what we collect, why, and
            what we never do.
          </p>
        </div>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <Section icon={Eye} title="What We Collect">
            <p>When you use {APP_NAME}, we collect only what is necessary to run the service:</p>
            <BulletList items={[
              'Your Google account email address and display name — obtained via Google Sign-In to identify your account.',
              'Financial data you enter: transactions, amounts, categories, dates, and descriptions.',
              'Budget targets, account names, and investment records you create.',
              'Optional profile information such as a display name you set within the app.',
            ]} />
            <p style={{ marginTop: 12 }}>
              We do <strong style={{ color: 'var(--text-primary)' }}>not</strong> collect
              your bank credentials, card numbers, or any payment information.
              All financial data is entered manually by you.
            </p>
          </Section>

          <Section icon={Shield} title="How We Use Your Data">
            <p>Your data is used solely to provide the {APP_NAME} service to you:</p>
            <BulletList items={[
              'Storing and displaying your transactions, budgets, and investments.',
              'Generating analytics, summaries, and spending insights shown within the app.',
              'Powering the AI advisor (Amadeus AI) — your transaction context is sent to a third-party LLM provider (e.g. Groq, Google Gemini) to generate responses. No personally identifiable information beyond financial context is included.',
              'Sending keep-alive pings to prevent the free-tier server from sleeping.',
            ]} />
            <p style={{ marginTop: 12 }}>
              We do <strong style={{ color: 'var(--text-primary)' }}>not</strong> use
              your data for advertising, marketing, profiling, or any purpose
              beyond operating the app for you.
            </p>
          </Section>

          <Section icon={Lock} title="Data Storage & Security">
            <BulletList items={[
              'Your data is stored in a PostgreSQL database hosted on a managed cloud provider.',
              'All data is associated with your unique Google user ID (not your email) — this means your data is isolated from other users.',
              'Authentication is handled entirely by Google OAuth — we never see or store your Google password.',
              'API requests between the frontend and backend are authenticated using a short-lived Google access token transmitted over HTTPS.',
              'Your session token is stored in your browser\'s sessionStorage only — it is never written to localStorage or cookies, and is cleared when you close the tab.',
            ]} />
          </Section>

          <Section icon={Shield} title="Third-Party Services">
            <p>
              {APP_NAME} uses the following third-party services. Each has its own
              privacy policy:
            </p>
            <BulletList items={[
              'Google OAuth — for authentication. Google\'s Privacy Policy applies.',
              'Groq / Google Gemini / Cohere / Cerebras / OpenRouter — for the AI advisor feature. Only your financial transaction context (amounts, categories, dates) is sent. No names or contact info is included in AI prompts.',
              'Render — for backend hosting.',
              'Vercel — for frontend hosting.',
              'Neon / Supabase (PostgreSQL) — for database hosting.',
            ]} />
          </Section>

          <Section icon={Trash2} title="Data Retention & Deletion">
            <BulletList items={[
              'Your data is retained as long as your account is active.',
              'You can delete individual transactions, budgets, and accounts at any time from within the app.',
              'To permanently delete your entire account and all associated data, email us at ' + CONTACT_EMAIL + ' with the subject line "Delete my account". We will process the deletion within 7 days.',
              'Session tokens in your browser (sessionStorage) are cleared automatically when you sign out or close the browser tab.',
            ]} />
          </Section>

          <Section icon={Eye} title="Your Rights">
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <BulletList items={[
              'Access the data we hold about you.',
              'Correct inaccurate data.',
              'Request deletion of your data.',
              'Export your data (use the Export & GST feature within the app for CSV/Excel export).',
            ]} />
            <p style={{ marginTop: 12 }}>
              To exercise any of these rights, contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                {CONTACT_EMAIL}
              </a>.
            </p>
          </Section>

          <Section icon={Mail} title="Contact">
            <p>
              If you have any questions about this Privacy Policy or how your
              data is handled, please reach out:
            </p>
            <p style={{ marginTop: 8 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Email:</strong>{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                {CONTACT_EMAIL}
              </a>
            </p>
            <p>
              <strong style={{ color: 'var(--text-primary)' }}>App:</strong>{' '}
              <a href={APP_URL} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                {APP_URL}
              </a>
            </p>
          </Section>

          {/* Footer note */}
          <p style={{
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 13,
            marginTop: 8,
            lineHeight: 1.7,
          }}>
            We may update this Privacy Policy from time to time. The "Last updated"
            date at the top will always reflect the most recent revision.
            Continued use of {APP_NAME} after changes constitutes acceptance of the
            updated policy.
          </p>

        </div>
      </div>
    </div>
  );
}
