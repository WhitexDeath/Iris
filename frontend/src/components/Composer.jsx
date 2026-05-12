import { useRef, useState, useEffect } from 'react';
import EmojiPicker from './EmojiPicker.jsx';

export default function Composer({ disabled, sendMessage, sendTyping, editMessage, actionState, onCancelAction }) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const typingRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (actionState?.type === 'edit') {
      const p = actionState.message.payload || {};
      setText(p.text || actionState.message.plaintext || '');
      inputRef.current?.focus();
    } else if (actionState?.type === 'reply') {
      inputRef.current?.focus();
    }
  }, [actionState]);

  function onChange(event) {
    setText(event.target.value);
    sendTyping(true);
    window.clearTimeout(typingRef.current);
    typingRef.current = window.setTimeout(() => sendTyping(false), 900);
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (!text.trim() || disabled) return;
    
    let sent = false;
    if (actionState?.type === 'edit') {
      sent = await editMessage(actionState.message.id, text);
    } else {
      sent = await sendMessage(text, { replyTo: actionState?.type === 'reply' ? actionState.message.id : undefined });
    }
    
    if (sent) {
      setText('');
      sendTyping(false);
      onCancelAction?.();
      setShowEmoji(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="sticky bottom-0 border-t border-line bg-ink/95 px-4 py-3 backdrop-blur-xl relative">
      <div className="mx-auto max-w-4xl relative">
        {actionState && (
          <div className="flex items-center justify-between mb-3 px-3 py-2 bg-black/20 rounded-xl border border-white/5">
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-mint mb-0.5">
                {actionState.type === 'edit' ? 'Editing Message' : 'Replying to Message'}
              </span>
              <span className="truncate text-sm text-slate-300">
                {actionState.message.payload?.text || actionState.message.plaintext}
              </span>
            </div>
            <button type="button" onClick={onCancelAction} className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white shrink-0 ml-4 transition-colors">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        
        {showEmoji && <EmojiPicker onSelect={(emoji) => setText(prev => prev + emoji)} onClose={() => setShowEmoji(false)} />}
        
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => setShowEmoji(!showEmoji)}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-slate-400 transition hover:text-white hover:bg-white/5 active:scale-95"
            title="Emojis"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <textarea
            ref={inputRef}
            value={text}
            onChange={onChange}
            disabled={disabled}
            rows={1}
            maxLength={3000}
            placeholder={disabled ? 'Select a trusted contact...' : 'Encrypted message'}
            className="max-h-36 min-h-[48px] flex-1 resize-none rounded-3xl border border-line bg-panel px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-mint disabled:cursor-not-allowed disabled:opacity-60"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                onCancelAction?.();
                setShowEmoji(false);
              } else if (event.key === 'Enter' && !event.shiftKey) {
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
      </div>
    </form>
  );
}
