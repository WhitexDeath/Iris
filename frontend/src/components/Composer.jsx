import { useRef, useState } from 'react';

export default function Composer({ disabled, sendMessage, sendTyping }) {
  const [text, setText] = useState('');
  const typingRef = useRef(null);

  function onChange(event) {
    setText(event.target.value);
    sendTyping(true);
    window.clearTimeout(typingRef.current);
    typingRef.current = window.setTimeout(() => sendTyping(false), 900);
  }

  async function onSubmit(event) {
    event.preventDefault();
    const sent = await sendMessage(text);
    if (sent) {
      setText('');
      sendTyping(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="sticky bottom-0 border-t border-line bg-ink/95 px-4 py-3 backdrop-blur-xl">
      <div className="mx-auto flex max-w-4xl items-end gap-3">
        <textarea
          value={text}
          onChange={onChange}
          disabled={disabled}
          rows={1}
          maxLength={3000}
          placeholder={disabled ? 'Select a trusted contact...' : 'Encrypted message'}
          className="max-h-36 min-h-[48px] flex-1 resize-none rounded-3xl border border-line bg-panel px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-mint disabled:cursor-not-allowed disabled:opacity-60"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-mint text-ink transition hover:bg-mintSoft active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          title="Send"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
            <path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </form>
  );
}
