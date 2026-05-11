import ConnectionBadge from './ConnectionBadge.jsx';

export default function UserProfileWidget({ displayName, userKey, status, onClick }) {
  const online = status === 'connected';

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 w-full rounded-2xl bg-panel/40 p-3 hover:bg-white/5 transition-colors text-left border border-white/5 shrink-0"
    >
      <div className="avatar">
        {(displayName || userKey || '?').slice(0, 1).toUpperCase()}
        <span className={`presence-dot ${online ? 'bg-mint' : 'bg-slate-500'}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-white leading-tight">
          {displayName || 'Me'}
        </div>
        <div className="truncate text-[11px] font-mono text-slate-500 mt-0.5">
          {userKey || 'Generating...'}
        </div>
      </div>
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </button>
  );
}
