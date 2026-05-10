export default function RoomSetup({
  displayName,
  setDisplayName,
  roomCode,
  setRoomCode,
  createRoom,
  joinRoom,
  error,
  socketUrl,
  publicKey
}) {
  return (
    <section className="flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="w-full max-w-md animate-rise rounded-[28px] border border-line bg-panel/95 p-6 shadow-glow backdrop-blur">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-mint text-xl font-black text-ink">I</div>
          <div>
            <h1 className="text-2xl font-semibold text-white">Iris Private Chat</h1>
            <p className="text-sm text-slate-400">Two people. Browser keys. No plaintext relay.</p>
          </div>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">Your display name</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="w-full rounded-2xl border border-line bg-ink px-4 py-3 text-white outline-none transition focus:border-mint"
              maxLength={32}
              placeholder="Me"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">Invite room code</span>
            <input
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value)}
              className="w-full rounded-2xl border border-line bg-ink px-4 py-3 text-lg font-semibold uppercase tracking-[0.18em] text-white outline-none transition focus:border-mint"
              maxLength={8}
              placeholder="ABC123"
            />
          </label>

          {error ? <p className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={createRoom}
              className="rounded-2xl bg-mint px-4 py-3 text-sm font-bold text-ink transition hover:bg-mintSoft active:scale-[0.98]"
            >
              Create Room
            </button>
            <button
              type="button"
              onClick={() => joinRoom()}
              className="rounded-2xl border border-line bg-panel2 px-4 py-3 text-sm font-bold text-white transition hover:border-mint active:scale-[0.98]"
            >
              Join Room
            </button>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-line bg-ink/70 p-4 text-xs leading-5 text-slate-400">
          <p>Relay: {socketUrl}</p>
          <p className="mt-2 break-all">Your public key: {publicKey || 'Generating...'}</p>
        </div>
      </div>
    </section>
  );
}
