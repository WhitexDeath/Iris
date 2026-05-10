export default function FingerprintPanel({ contact, verifyContact }) {
  if (!contact) return null;

  return (
    <aside className="fingerprint-panel">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Safety fingerprint</p>
          <h3 className="mt-1 text-base font-semibold text-white">{contact.displayName}</h3>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${contact.verified ? 'bg-mint text-ink' : 'bg-amber-300/15 text-amber-100'}`}>
          {contact.verified ? 'Verified' : 'Unverified'}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        Compare this fingerprint with your contact out-of-band before trusting the key.
      </p>
      <p className="mt-4 break-words rounded-[18px] border border-white/10 bg-ink/60 p-3 font-mono text-xs leading-5 text-slate-200">
        {contact.fingerprint}
      </p>
      <button type="button" onClick={() => verifyContact(contact.userKey)} className="secondary-button mt-4 w-full">
        Mark fingerprint verified
      </button>
    </aside>
  );
}
