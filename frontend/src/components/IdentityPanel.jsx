import { useState } from 'react';
import ConnectionBadge from './ConnectionBadge.jsx';

export default function IdentityPanel({
  identity,
  fingerprint,
  displayName,
  setDisplayName,
  recoveryCode,
  restoreIdentity,
  status
}) {
  const [copied, setCopied] = useState('');
  const [showRecovery, setShowRecovery] = useState(false);
  const [restoreValue, setRestoreValue] = useState('');

  async function copy(value, label) {
    await navigator.clipboard?.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(''), 1400);
  }

  async function restore(event) {
    event.preventDefault();
    if (!restoreValue.trim()) return;
    await restoreIdentity(restoreValue);
  }

  return (
    <section className="identity-panel">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="brand-mark">I</div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-white">Your Iris identity</h3>
            <p className="truncate text-xs text-slate-400">No email, phone number, or account provider</p>
          </div>
        </div>
        <ConnectionBadge status={status} />
      </div>

      <label className="mt-5 block">
        <span className="field-label">Display name</span>
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className="field"
          maxLength={40}
          placeholder="Me"
        />
      </label>

      <div className="identity-key-card">
        <div>
          <p className="field-label">Your Iris ID</p>
          <p className="mt-1 font-mono text-xl font-bold tracking-[0.12em] text-mint">
            {identity?.userKey || 'IRIS------'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => copy(identity?.userKey || '', 'id')}
          className="secondary-button"
          disabled={!identity?.userKey}
        >
          {copied === 'id' ? 'Copied' : 'Copy ID'}
        </button>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">
        Share only this short ID. People can add you directly while you are registered on this Iris relay.
      </p>

      <div className="mt-5 border-t border-white/10 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Recovery key</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Use this secret key to restore your Iris ID in another browser. Keep it private.
            </p>
          </div>
          <button type="button" onClick={() => setShowRecovery((current) => !current)} className="text-button">
            {showRecovery ? 'Hide' : 'Show'}
          </button>
        </div>

        {showRecovery ? (
          <div className="mt-3">
            <textarea className="field recovery-field" value={recoveryCode} readOnly rows={3} aria-label="Your Iris recovery key" />
            <button type="button" onClick={() => copy(recoveryCode, 'recovery')} className="secondary-button mt-2 w-full">
              {copied === 'recovery' ? 'Recovery key copied' : 'Copy recovery key'}
            </button>
          </div>
        ) : null}
      </div>

      <details className="mt-5 border-t border-white/10 pt-5">
        <summary className="cursor-pointer text-sm font-semibold text-white">Restore an existing Iris identity</summary>
        <form onSubmit={restore} className="mt-3">
          <textarea
            value={restoreValue}
            onChange={(event) => setRestoreValue(event.target.value)}
            className="field recovery-field"
            rows={3}
            placeholder="Paste your private IRIS-RECOVERY key"
            aria-label="Recovery key to restore"
          />
          <p className="mt-2 text-xs leading-5 text-amber-200/80">
            Restoring a different identity clears this browser's local contacts and messages.
          </p>
          <button type="submit" className="secondary-button mt-3 w-full" disabled={!restoreValue.trim()}>
            Restore identity
          </button>
        </form>
      </details>

      <div className="mt-5 rounded-[18px] border border-white/10 bg-ink/50 p-3">
        <p className="field-label">Safety fingerprint</p>
        <p className="mt-2 break-words font-mono text-xs leading-5 text-slate-300">{fingerprint || 'Generating...'}</p>
      </div>
    </section>
  );
}
