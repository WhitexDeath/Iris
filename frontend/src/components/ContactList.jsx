import { useMemo, useState } from 'react';

function initials(contact) {
  return (contact.displayName || contact.userKey || '?').slice(0, 1).toUpperCase();
}

export default function ContactList({ contacts, presence, selectedUserKey, setSelectedUserKey, onNewChat }) {
  const [query, setQuery] = useState('');
  const filteredContacts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return contacts;
    return contacts.filter((contact) =>
      `${contact.displayName} ${contact.userKey}`.toLowerCase().includes(normalized)
    );
  }, [contacts, query]);

  return (
    <section className="min-h-0 flex-1 flex flex-col">
      <div className="mb-5 flex items-center gap-3 px-1 shrink-0">
        <div className="brand-mark !h-10 !w-10 !rounded-[14px] !text-base">I</div>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-white">Iris</h1>
          <p className="text-xs text-slate-400">Chat without an account</p>
        </div>
      </div>
      <button type="button" onClick={onNewChat} className="primary-button mb-4 w-full gap-2">
        <span className="text-lg leading-none">+</span>
        New chat
      </button>
      <label className="relative mb-4 block shrink-0">
        <span className="sr-only">Search contacts</span>
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m21 21-4.35-4.35m1.35-5.15a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
        </svg>
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="field !py-2.5 !pl-9 text-sm" placeholder="Search contacts" />
      </label>
      <div className="mb-3 flex items-center justify-between px-1 shrink-0">
        <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Conversations</h2>
        <span className="text-xs text-slate-500">{contacts.length}</span>
      </div>
      <div className="contact-scroll">
        {contacts.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-white/10 p-5 text-center text-sm text-slate-400">
            Add an Iris ID to begin your first conversation.
          </div>
        ) : null}

        {contacts.length > 0 && filteredContacts.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-slate-500">No matching contacts</p>
        ) : null}

        {filteredContacts.map((contact) => {
          const active = selectedUserKey === contact.userKey;
          const online = presence[contact.userKey]?.online;
          return (
            <button
              type="button"
              key={contact.userKey}
              onClick={() => setSelectedUserKey(contact.userKey)}
              aria-pressed={active}
              className={`contact-row ${active ? 'contact-row-active' : ''} ${contact.unreadCount ? 'bg-white/5' : ''}`}
            >
              <span className="avatar">
                {initials(contact)}
                <span className={`presence-dot ${online ? 'bg-mint' : 'bg-slate-500'}`} />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className={`block truncate text-sm font-semibold ${contact.unreadCount ? 'text-mint' : 'text-white'}`}>{contact.displayName}</span>
                <span className={`block truncate font-mono text-[11px] ${contact.unreadCount ? 'text-mint/70 font-bold' : 'text-slate-500'}`}>{contact.userKey}</span>
              </span>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {contact.unreadCount ? (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white shadow-sm">
                    {contact.unreadCount > 99 ? '99+' : contact.unreadCount}
                  </span>
                ) : null}
                {contact.verified ? (
                  <span className="verified-badge shrink-0" title="Fingerprint verified">
                    <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
