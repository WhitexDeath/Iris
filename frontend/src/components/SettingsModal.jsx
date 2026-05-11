import IdentityPanel from './IdentityPanel.jsx';
import AddContact from './AddContact.jsx';

export default function SettingsModal({ isOpen, onClose, chat }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">User Settings</h2>
          <button type="button" onClick={onClose} className="icon-button shrink-0" title="Close">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-6">
          <IdentityPanel
            identity={chat.identity}
            fingerprint={chat.fingerprint}
            displayName={chat.displayName}
            setDisplayName={chat.setDisplayName}
            sharePayload={chat.sharePayload}
            status={chat.status}
          />
          <AddContact addContact={chat.addContact} error={chat.error} />
        </div>
      </div>
    </div>
  );
}
