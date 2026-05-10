import { useMemo, useState } from 'react';
import ConnectionBadge from './ConnectionBadge.jsx';
import { userKeyQrModules } from '../lib/qr.js';

export default function IdentityPanel({ identity, fingerprint, displayName, setDisplayName, sharePayload, status }) {
  const [copied, setCopied] = useState(false);
  const modules = useMemo(() => (identity?.userKey ? userKeyQrModules(identity.userKey) : []), [identity?.userKey]);

  async function copyShare() {
    await navigator.clipboard?.writeText(sharePayload);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <section className="identity-panel">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="brand-mark">I</div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-white">Iris</h1>
            <p className="truncate text-xs text-slate-400">Private identity messenger</p>
          </div>
        </div>
        <ConnectionBadge status={status} />
      </div>

      <label className="mt-5 block">
        <span className="mb-2 block text-xs font-semibold uppercase text-slate-500">Display name</span>
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className="field"
          maxLength={40}
          placeholder="Me"
        />
      </label>

      <div className="mt-5 rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Your User Key</p>
            <p className="mt-1 font-mono text-xl font-bold tracking-[0.12em] text-mint">
              {identity?.userKey || 'IRIS------'}
            </p>
          </div>
          <button type="button" onClick={copyShare} className="icon-button" title="Copy contact payload">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
              <path d="M8 8V6.8C8 5.81 8.81 5 9.8 5H18.2C19.19 5 20 5.81 20 6.8V15.2C20 16.19 19.19 17 18.2 17H17M5.8 8H14.2C15.19 8 16 8.81 16 9.8V18.2C16 19.19 15.19 20 14.2 20H5.8C4.81 20 4 19.19 4 18.2V9.8C4 8.81 4.81 8 5.8 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="mt-4 grid place-items-center rounded-[18px] bg-slate-50 p-3">
          {modules.length ? (
            <svg viewBox="0 0 29 29" className="h-44 w-44" role="img" aria-label="QR code for your Iris User Key">
              <rect width="29" height="29" fill="#f8fafc" />
              {modules.map((row, y) =>
                row.map((dark, x) =>
                  dark ? <rect key={`${x}-${y}`} x={x + 4} y={y + 4} width="1" height="1" fill="#07110d" /> : null
                )
              )}
            </svg>
          ) : (
            <div className="h-44 w-44" />
          )}
        </div>

        <p className="mt-3 text-center text-xs text-slate-400">
          {copied ? 'Copied contact payload' : 'QR shares your User Key. Copy includes the full trusted key payload.'}
        </p>
      </div>

      <div className="mt-4 rounded-[18px] border border-white/10 bg-ink/50 p-3">
        <p className="text-xs font-semibold uppercase text-slate-500">Fingerprint</p>
        <p className="mt-2 break-words font-mono text-xs leading-5 text-slate-300">{fingerprint || 'Generating...'}</p>
      </div>
    </section>
  );
}
