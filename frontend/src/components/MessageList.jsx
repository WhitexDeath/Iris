import { useEffect, useRef, useState } from 'react';
import { decryptAttachment } from '../lib/crypto';

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

function AttachmentImage({ payload }) {
  const [source, setSource] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = '';

    async function loadImage() {
      try {
        const response = await fetch(`/media/${encodeURIComponent(payload.mediaId)}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Attachment unavailable.');
        const ciphertext = await response.arrayBuffer();
        const blob = decryptAttachment({ ...payload, ciphertext });
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      } catch (error) {
        if (error.name !== 'AbortError') setFailed(true);
      }
    }

    loadImage();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [payload]);

  if (failed) return <div className="attachment-state">Encrypted image unavailable</div>;
  if (!source) return <div className="attachment-state animate-pulse">Decrypting image...</div>;

  return (
    <button type="button" className="attachment-image" onClick={() => window.open(source, '_blank')} aria-label="Open image attachment">
      <img src={source} alt={payload.fileName || 'Encrypted attachment'} loading="lazy" />
    </button>
  );
}

export default function MessageList({ messages, peerTyping, contact, onAction, onDelete }) {
  const endRef = useRef(null);
  const containerRef = useRef(null);
  const prevCount = useRef(messages.length);
  const [showNewMessages, setShowNewMessages] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isNewMessage = messages.length > prevCount.current;
    const lastMessage = messages[messages.length - 1];
    const isMyMessage = lastMessage?.sender === 'me';
    
    // Check if we are near the bottom.
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 300;

    if (isNewMessage) {
      if (isMyMessage || isNearBottom) {
        endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        setShowNewMessages(false);
      } else {
        setShowNewMessages(true);
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

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    if (isNearBottom && showNewMessages) {
      setShowNewMessages(false);
    }
  };

  return (
    <main className="message-list relative" ref={containerRef} onScroll={handleScroll}>
      {!contact ? (
        <div className="empty-state">
          <p className="text-xl font-semibold text-white">Your conversations start here</p>
          <p className="mt-2 text-sm text-slate-400">
            Add a short Iris ID, then send messages and encrypted images without creating a traditional account.
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

      {messages.map((message, index) => {
        const mine = message.sender === 'me';
        const payload = message.payload || { text: message.plaintext };
        const isDeleted = message.deleted;
        let text = isDeleted ? 'Message deleted' : (payload.text || message.plaintext);
        if (payload.type === 'image' && !isDeleted) {
          text = payload.caption || '';
        }
        
        let replyTarget = null;
        if (payload.replyTo) {
          replyTarget = messages.find(m => m.id === payload.replyTo);
        }

        const prevMessage = index > 0 ? messages[index - 1] : null;
        const isFirstInGroup = !prevMessage || prevMessage.sender !== message.sender || message.createdAt - prevMessage.createdAt > 300000;

        return (
          <div id={`msg-${message.id}`} key={message.id} className={`flex group animate-rise ${mine ? 'justify-end' : 'justify-start'} ${isFirstInGroup ? 'mt-3' : 'mt-1'}`}>
            
            <div className={`flex items-center gap-1 mx-1 md:mx-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity ${mine ? 'order-1 flex-row-reverse' : 'order-2'}`}>
              {!isDeleted && (
                <button type="button" onClick={() => onAction('reply', message)} className="message-action" title="Reply" aria-label="Reply to message">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                </button>
              )}
              {mine && !isDeleted && payload.type !== 'image' && (
                <button type="button" onClick={() => onAction('edit', message)} className="message-action" title="Edit" aria-label="Edit message">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
              )}
              {mine && !isDeleted && (
                <button type="button" onClick={() => { if(window.confirm('Delete this message for everyone?')) onDelete(message.id); }} className="message-action hover:!text-red-300" title="Delete" aria-label="Delete message">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              )}
            </div>

            <div className={`max-w-[82%] sm:max-w-[68%] flex flex-col ${mine ? 'order-2 items-end' : 'order-1 items-start'}`}>
              <div
                className={`px-4 py-2.5 text-[15px] leading-relaxed shadow-sm relative ${
                  mine
                    ? 'bg-mint text-ink'
                    : 'bg-panel2 border border-white/5 text-slate-100'
                } ${
                   isFirstInGroup
                     ? mine ? 'rounded-2xl rounded-tr-md' : 'rounded-2xl rounded-tl-md'
                     : 'rounded-2xl'
                } ${isDeleted ? 'italic opacity-60' : ''}`}
              >
                {replyTarget && !isDeleted && (
                  <div 
                    className={`mb-1.5 p-2 rounded-lg text-xs border-l-2 cursor-pointer transition-opacity hover:opacity-80 ${mine ? 'bg-black/10 border-ink/40 text-ink/80' : 'bg-black/20 border-mint text-slate-300'}`}
                    onClick={() => {
                       const el = document.getElementById(`msg-${replyTarget.id}`);
                       if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                  >
                    <div className="font-semibold mb-0.5 truncate">{replyTarget.sender === 'me' ? 'You' : contact.displayName}</div>
                    <div className="truncate opacity-80">{replyTarget.payload?.text || replyTarget.plaintext}</div>
                  </div>
                )}

                {payload.type === 'image' && !isDeleted && (
                  <AttachmentImage payload={payload} />
                )}
                
                {text && <p className="whitespace-pre-wrap break-words">{text}</p>}
                <div className={`mt-1 flex items-center justify-end gap-1.5 text-[11px] font-medium ${mine ? 'text-emerald-950/70' : 'text-slate-400'}`}>
                  {message.edited && !isDeleted && <span>(edited)</span>}
                  <span>{formatTime(message.createdAt)}</span>
                  {mine && (
                    <span>
                      {message.status === 'delivered' ? (
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 inline" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 12l5 5L20 7" /></svg>
                      ) : message.status === 'sent' ? (
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 inline opacity-60" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 12l5 5L20 7" /></svg>
                      ) : (
                        <span className="opacity-60">·</span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
          </div>
        );
      })}

      {peerTyping ? (
        <div className="flex justify-start mt-2">
          <TypingIndicator />
        </div>
      ) : null}

      {showNewMessages && (
        <div className="sticky bottom-4 left-0 right-0 flex justify-center z-10 pointer-events-none">
          <button
            onClick={() => {
              endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
              setShowNewMessages(false);
            }}
            className="pointer-events-auto bg-mint/90 hover:bg-mint text-ink text-sm font-semibold py-1.5 px-4 rounded-full shadow-lg shadow-black/20 backdrop-blur-sm transition-all animate-rise flex items-center gap-1.5"
          >
            New Messages
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
          </button>
        </div>
      )}

      <div ref={endRef} />
    </main>
  );
}
