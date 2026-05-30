import { useState, useEffect } from 'react';
import ChatHeader from './components/ChatHeader.jsx';
import Composer from './components/Composer.jsx';
import ContactList from './components/ContactList.jsx';
import FingerprintPanel from './components/FingerprintPanel.jsx';
import MessageList from './components/MessageList.jsx';
import SafetyModal from './components/SafetyModal.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import UserProfileWidget from './components/UserProfileWidget.jsx';
import { useEncryptedChat } from './hooks/useEncryptedChat.js';
import { requestNotificationPermission } from './lib/notifications.js';

export default function App() {
  const chat = useEncryptedChat();
  const peerTyping = chat.peerTypingKey && chat.peerTypingKey === chat.selectedContact?.userKey;
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState('identity');
  const [isSafetyOpen, setIsSafetyOpen] = useState(false);
  const [actionState, setActionState] = useState(null); // { type: 'edit' | 'reply', message: msgObj }
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    import('./lib/versionCheck.js').then(({ checkForUpdates }) => {
      checkForUpdates().then((needsUpdate) => {
        if (needsUpdate) {
          setIsUpdating(true);
          setTimeout(() => window.location.reload(true), 1500);
        }
      });
    });
  }, []);

  // Clear action state when contact changes
  useEffect(() => {
    setActionState(null);
    setIsSafetyOpen(false);
  }, [chat.selectedUserKey]);

  useEffect(() => {
    function handleFocus() {
      if (chat.selectedUserKey) {
        chat.clearUnread(chat.selectedUserKey);
      }
    }

    if (chat.selectedUserKey && document.hasFocus()) {
      chat.clearUnread(chat.selectedUserKey);
    }

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [chat.selectedUserKey, chat.clearUnread]);

  useEffect(() => {
    function handleInteraction() {
      requestNotificationPermission();
      window.removeEventListener('click', handleInteraction);
    }
    window.addEventListener('click', handleInteraction);
    return () => window.removeEventListener('click', handleInteraction);
  }, []);

  return (
    <>
      {isUpdating && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 text-white backdrop-blur-sm animate-in fade-in duration-300">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-mint border-t-transparent mb-4"></div>
          <p className="text-lg font-semibold text-mint">Updating to latest version...</p>
          <p className="text-sm text-slate-400 mt-2">Refreshing cache</p>
        </div>
      )}
      <div className={`app-shell ${chat.selectedContact ? 'app-shell-with-safety' : ''}`}>
        <aside className={`sidebar ${chat.selectedUserKey ? 'hidden min-[820px]:flex' : 'flex'} flex-col justify-between`}>
          <div className="flex-1 min-h-0 flex flex-col">
            <ContactList
              contacts={chat.contacts}
              presence={chat.presence}
              selectedUserKey={chat.selectedUserKey}
              setSelectedUserKey={chat.setSelectedUserKey}
              onNewChat={() => {
                setSettingsView('new-chat');
                setIsSettingsOpen(true);
              }}
            />
          </div>
          <div className="pt-3 border-t border-white/5 mt-3 shrink-0">
            <UserProfileWidget
              displayName={chat.displayName}
              userKey={chat.identity?.userKey}
              status={chat.status}
              onClick={() => {
                setSettingsView('identity');
                setIsSettingsOpen(true);
              }}
            />
          </div>
        </aside>

        <section className={`chat-pane ${chat.selectedUserKey ? 'flex' : 'hidden min-[820px]:flex'}`}>
          <ChatHeader
            contact={chat.selectedContact}
            presence={chat.presence}
            onBack={() => chat.setSelectedUserKey('')}
            onDelete={() => {
              if (window.confirm(`Delete contact ${chat.selectedContact?.displayName} and all messages?`)) {
                chat.removeContact(chat.selectedUserKey);
              }
            }}
            onOpenSafety={() => setIsSafetyOpen(true)}
          />
          <MessageList 
            messages={chat.messages} 
            peerTyping={peerTyping} 
            contact={chat.selectedContact} 
            onAction={(type, msg) => setActionState({ type, message: msg })}
            onDelete={chat.deleteMessage}
          />
          <Composer 
            disabled={!chat.isReady} 
            sendMessage={chat.sendMessage} 
            sendAttachment={chat.sendAttachment}
            sendTyping={chat.sendTyping} 
            editMessage={chat.editMessage}
            actionState={actionState}
            onCancelAction={() => setActionState(null)}
          />
        </section>

        {chat.selectedContact ? (
          <div id="safety-panel" className="safety-column">
            <FingerprintPanel contact={chat.selectedContact} verifyContact={chat.verifyContact} />
          </div>
        ) : null}
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        chat={chat} 
        initialView={settingsView}
      />
      {isSafetyOpen ? (
        <SafetyModal contact={chat.selectedContact} verifyContact={chat.verifyContact} onClose={() => setIsSafetyOpen(false)} />
      ) : null}
      {chat.error ? (
        <div className="error-toast" role="alert">
          <span>{chat.error}</span>
          <button type="button" onClick={chat.clearError} aria-label="Dismiss error">Close</button>
        </div>
      ) : null}
    </>
  );
}
