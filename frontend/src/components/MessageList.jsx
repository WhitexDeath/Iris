import { useEffect, useRef } from 'react';

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-panel2 px-4 py-3">
      <span className="h-2 w-2 animate-pulseDot rounded-full bg-slate-300" />
      <span className="h-2 w-2 animate-pulseDot rounded-full bg-slate-300 [animation-delay:120ms]" />
      <span className="h-2 w-2 animate-pulseDot rounded-full bg-slate-300 [animation-delay:240ms]" />
    </div>
  );
}

export default function MessageList({ messages, peerTyping, contact }) {
  const endRef = useRef(null);
  const containerRef = useRef(null);
  const prevCount = useRef(messages.length);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isNewMessage = messages.length > prevCount.current;
    const lastMessage = messages[messages.length - 1];
    const isMyMessage = lastMessage?.sender === 'me';
    
    // Check if we are near the bottom. Since DOM already updated, we use a generous threshold
    // of 300px to account for the height of the newly added message.
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 300;

    if (isNewMessage) {
      if (isMyMessage || isNearBottom) {
        endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    } else if (peerTyping) {
      if (isNearBottom) {
        endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    } else if (messages.length > 0 && prevCount.current === 0) {
      // Initial load of messages
      endRef.current?.scrollIntoView({ block: 'end' });
    }

    prevCount.current = messages.length;
  }, [messages, peerTyping]);

  return (
    <main className="message-list" ref={containerRef}>
      {!contact ? (
        <div className="empty-state">
          <p className="text-xl font-semibold text-white">Your private address book is ready</p>
          <p className="mt-2 text-sm text-slate-400">
            Add a contact by User Key, compare fingerprints, then send encrypted messages directly between identities.
          </p>
        </div>
      ) : messages.length === 0 ? (
        <div className="empty-state">
          <p className="text-lg font-semibold text-white">No messages with {contact.displayName} yet</p>
          <p className="mt-2 text-sm text-slate-400">
            The first message is encrypted locally before it leaves this browser.
          </p>
        </div>
      ) : null}

      {messages.map((message) => {
        const mine = message.sender === 'me';
        return (
          <div key={message.id} className={`flex animate-rise ${mine ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[82%] rounded-3xl px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[68%] ${
                mine
                  ? 'rounded-br-md bg-mint text-ink'
                  : 'rounded-bl-md border border-line bg-panel2 text-slate-100'
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{message.plaintext}</p>
              <div className={`mt-1 text-right text-[11px] ${mine ? 'text-emerald-950/70' : 'text-slate-400'}`}>
                {formatTime(message.createdAt)}
                {mine ? ` - ${message.status}` : ''}
              </div>
            </div>
          </div>
        );
      })}

      {peerTyping ? (
        <div className="flex justify-start">
          <TypingIndicator />
        </div>
      ) : null}
      <div ref={endRef} />
    </main>
  );
}
