import AddContact from './components/AddContact.jsx';
import ChatHeader from './components/ChatHeader.jsx';
import Composer from './components/Composer.jsx';
import ContactList from './components/ContactList.jsx';
import FingerprintPanel from './components/FingerprintPanel.jsx';
import IdentityPanel from './components/IdentityPanel.jsx';
import MessageList from './components/MessageList.jsx';
import { useEncryptedChat } from './hooks/useEncryptedChat.js';

export default function App() {
  const chat = useEncryptedChat();
  const peerTyping = chat.peerTypingKey && chat.peerTypingKey === chat.selectedContact?.userKey;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <IdentityPanel
          identity={chat.identity}
          fingerprint={chat.fingerprint}
          displayName={chat.displayName}
          setDisplayName={chat.setDisplayName}
          sharePayload={chat.sharePayload}
          status={chat.status}
        />
        <AddContact addContact={chat.addContact} error={chat.error} />
        <ContactList
          contacts={chat.contacts}
          presence={chat.presence}
          selectedUserKey={chat.selectedUserKey}
          setSelectedUserKey={chat.setSelectedUserKey}
        />
      </aside>

      <section className="chat-pane">
        <ChatHeader
          contact={chat.selectedContact}
          presence={chat.presence}
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
  );
}
