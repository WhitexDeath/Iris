import { useState } from 'react';

export default function AddContact({ addContact, error }) {
  const [input, setInput] = useState('');
  const [alias, setAlias] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    const ok = await addContact(input, alias);
    setBusy(false);
    if (ok) {
      setInput('');
      setAlias('');
    }
  }

  return (
    <form onSubmit={onSubmit} className="add-contact">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Add Contact</h2>
        <span className="text-xs text-slate-500">User Key or QR payload</span>
      </div>
      <input
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className="field mt-3 font-mono tracking-[0.08em]"
        placeholder="IRIS-8F2A91"
      />
      <input
        value={alias}
        onChange={(event) => setAlias(event.target.value)}
        className="field mt-2"
        placeholder="Name, optional"
      />
      {error ? <p className="mt-3 rounded-2xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-100">{error}</p> : null}
      <button type="submit" disabled={busy || !input.trim()} className="primary-button mt-3 w-full">
        {busy ? 'Adding...' : 'Add trusted contact'}
      </button>
    </form>
  );
}
