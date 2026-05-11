export default function FingerprintPanel({ contact, verifyContact }) {
  if (!contact) return null;

  return (
    <aside className="fingerprint-panel p-4 border border-white/5 bg-panel/50 rounded-2xl">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Safety fingerprint</p>
          <h3 className="text-sm font-semibold text-white truncate max-w-[140px]">{contact.displayName}</h3>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 ${contact.verified ? 'bg-mint/20 text-mint' : 'bg-amber-500/20 text-amber-300'}`}>
          {contact.verified ? 'Verified' : 'Unverified'}
        </span>
      </div>
      <p className="mt-3 break-words rounded-xl border border-white/5 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-slate-300 select-all">
        {contact.fingerprint}
      </p>
      {!contact.verified && (
        <button type="button" onClick={() => verifyContact(contact.userKey)} className="secondary-button mt-3 w-full text-xs py-2">
          Verify Fingerprint
        </button>
      )}
    </aside>
  );
}
