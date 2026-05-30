export default function ChatHeader({ contact, presence, onBack, onDelete, onOpenSafety }) {
  if (!contact) {
    return (
      <header className="chat-header hidden min-[820px]:flex">
        <div>
          <h2 className="text-lg font-semibold text-white">Select a contact</h2>
          <p className="text-sm text-slate-400">Choose a conversation or start a new chat with an Iris ID.</p>
        </div>
      </header>
    );
  }

  const online = presence[contact.userKey]?.online;

  return (
    <header className="chat-header">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="icon-button min-[820px]:hidden"
          title="Back to contacts"
          aria-label="Back to contacts"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="avatar avatar-large">
          {(contact.displayName || contact.userKey).slice(0, 1).toUpperCase()}
          <span className={`presence-dot ${online ? 'bg-mint' : 'bg-slate-500'}`} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-white">{contact.displayName}</h2>
            {contact.verified ? <span className="verified-badge">OK</span> : null}
          </div>
          <p className="truncate text-xs text-slate-400 sm:text-sm">
            {online ? 'Online now' : 'Offline - encrypted queue'} - {contact.userKey}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button type="button" onClick={onOpenSafety} className="secondary-button shrink-0">
          Verify
        </button>
        <button type="button" onClick={onDelete} className="icon-button !text-rose-400 hover:!border-rose-400/50 hover:!bg-rose-400/10" title="Delete contact" aria-label="Delete contact">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </header>
  );
}
