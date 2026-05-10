const statusCopy = {
  idle: 'Not connected',
  connecting: 'Connecting',
  connected: 'Connected',
  reconnecting: 'Reconnecting',
  offline: 'Offline'
};

export default function ConnectionBadge({ status }) {
  const isLive = status === 'connected';
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-line bg-panel2/80 px-3 py-1 text-xs font-medium text-slate-200">
      <span className={`h-2 w-2 rounded-full ${isLive ? 'bg-mint shadow-[0_0_12px_#45e5a7]' : 'bg-amber-400'}`} />
      {statusCopy[status] || status}
    </div>
  );
}
