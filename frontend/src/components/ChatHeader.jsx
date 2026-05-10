export default function ChatHeader({ contact, presence, onOpenSafety }) {
  if (!contact) {
    return (
      <header className="chat-header">
        <div>
          <h2 className="text-lg font-semibold text-white">Select a contact</h2>
          <p className="text-sm text-slate-400">Direct messages are encrypted to permanent Iris identities.</p>
        </div>
      </header>
    );
  }

  const online = presence[contact.userKey]?.online;

  return (
    <header className="chat-header">
      <div className="flex min-w-0 items-center gap-3">
        <div className="avatar avatar-large">
          {(contact.displayName || contact.userKey).slice(0, 1).toUpperCase()}
          <span className={`presence-dot ${online ? 'bg-mint' : 'bg-slate-500'}`} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-white">{contact.displayName}</h2>
            {contact.verified ? <span className="verified-badge">OK</span> : null}
          </div>
          <p className="truncate text-sm text-slate-400">
            {online ? 'Online now' : 'Offline - messages queue encrypted'} - {contact.userKey}
          </p>
        </div>
      </div>
      <button type="button" onClick={onOpenSafety} className="secondary-button shrink-0">
        Safety
      </button>
    </header>
  );
}
