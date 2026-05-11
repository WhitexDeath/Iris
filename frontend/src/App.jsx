import { useState } from 'react';
import ChatHeader from './components/ChatHeader.jsx';
import Composer from './components/Composer.jsx';
import ContactList from './components/ContactList.jsx';
import FingerprintPanel from './components/FingerprintPanel.jsx';
import MessageList from './components/MessageList.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import UserProfileWidget from './components/UserProfileWidget.jsx';
import { useEncryptedChat } from './hooks/useEncryptedChat.js';

export default function App() {
  const chat = useEncryptedChat();
  const peerTyping = chat.peerTypingKey && chat.peerTypingKey === chat.selectedContact?.userKey;
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <div className="app-shell">
        <aside className={`sidebar ${chat.selectedUserKey ? 'hidden min-[820px]:flex' : 'flex'} flex-col justify-between`}>
          <div className="flex-1 min-h-0 flex flex-col">
            <ContactList
              contacts={chat.contacts}
              presence={chat.presence}
              selectedUserKey={chat.selectedUserKey}
              setSelectedUserKey={chat.setSelectedUserKey}
            />
          </div>
          <div className="pt-3 border-t border-white/5 mt-3 shrink-0">
            <UserProfileWidget
              displayName={chat.displayName}
              userKey={chat.identity?.userKey}
              status={chat.status}
              onClick={() => setIsSettingsOpen(true)}
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
            onOpenSafety={() => {
              document.getElementById('safety-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }}
          />
          <MessageList messages={chat.messages} peerTyping={peerTyping} contact={chat.selectedContact} />
          <Composer disabled={!chat.isReady} sendMessage={chat.sendMessage} sendTyping={chat.sendTyping} />
        </section>

        <div id="safety-panel" className="safety-column">
          <FingerprintPanel contact={chat.selectedContact} verifyContact={chat.verifyContact} />
        </div>
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        chat={chat} 
      />
    </>
  );
}
