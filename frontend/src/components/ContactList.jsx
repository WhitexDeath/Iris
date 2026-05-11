function initials(contact) {
  return (contact.displayName || contact.userKey || '?').slice(0, 1).toUpperCase();
}

export default function ContactList({ contacts, presence, selectedUserKey, setSelectedUserKey }) {
  return (
    <section className="min-h-0 flex-1">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-white">Contacts</h2>
        <span className="text-xs text-slate-500">{contacts.length}</span>
      </div>
      <div className="contact-scroll">
        {contacts.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-white/10 p-5 text-center text-sm text-slate-400">
            Add one trusted User Key to start direct encrypted messaging.
          </div>
        ) : null}

        {contacts.map((contact) => {
          const active = selectedUserKey === contact.userKey;
          const online = presence[contact.userKey]?.online;
          return (
            <button
              type="button"
              key={contact.userKey}
              onClick={() => setSelectedUserKey(contact.userKey)}
              className={`contact-row ${active ? 'contact-row-active' : ''}`}
            >
              <span className="avatar">
                {initials(contact)}
                <span className={`presence-dot ${online ? 'bg-mint' : 'bg-slate-500'}`} />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-semibold text-white">{contact.displayName}</span>
                <span className="block truncate font-mono text-[11px] text-slate-500">{contact.userKey}</span>
              </span>
              {contact.verified ? (
                <span className="verified-badge shrink-0" title="Fingerprint verified">
                  <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
