import { useEffect, useState } from 'react';
import IdentityPanel from './IdentityPanel.jsx';
import AddContact from './AddContact.jsx';

export default function SettingsModal({ isOpen, onClose, chat, initialView = 'identity' }) {
  const [activeView, setActiveView] = useState(initialView);

  useEffect(() => {
    if (isOpen) setActiveView(initialView);
  }, [initialView, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Settings</h2>
            <p className="mt-1 text-xs text-slate-400">Identity, recovery, and new conversations</p>
          </div>
          <button type="button" onClick={onClose} className="icon-button shrink-0" title="Close">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="settings-tabs" role="tablist" aria-label="Settings sections">
          <button type="button" role="tab" aria-selected={activeView === 'new-chat'} onClick={() => setActiveView('new-chat')} className={activeView === 'new-chat' ? 'settings-tab settings-tab-active' : 'settings-tab'}>
            New chat
          </button>
          <button type="button" role="tab" aria-selected={activeView === 'identity'} onClick={() => setActiveView('identity')} className={activeView === 'identity' ? 'settings-tab settings-tab-active' : 'settings-tab'}>
            Identity
          </button>
        </div>

        {activeView === 'new-chat' ? (
          <AddContact addContact={chat.addContact} error={chat.error} />
        ) : (
          <IdentityPanel
            identity={chat.identity}
            fingerprint={chat.fingerprint}
            displayName={chat.displayName}
            setDisplayName={chat.setDisplayName}
            recoveryCode={chat.recoveryCode}
            restoreIdentity={chat.restoreIdentity}
            status={chat.status}
          />
        )}
      </div>
    </div>
  );
}
