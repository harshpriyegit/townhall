import { useState, useRef, useEffect } from 'react'
import '../styles/messages.css'

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

const MOCK_CONVERSATIONS = [
  {
    id: 'conv-1',
    user: { fullName: 'Priya Sharma', username: 'priya' },
    online: true,
    unread: true,
    lastMessage: 'Hey! Are you coming to the fest tonight?',
    lastTime: '2m ago',
    messages: [
      { id: 1, text: 'Hey! How are you?', sent: false, time: '10:30 AM' },
      { id: 2, text: 'I\'m good! Just finishing some assignments.', sent: true, time: '10:32 AM' },
      { id: 3, text: 'Same here 😅 DSA is killing me', sent: false, time: '10:33 AM' },
      { id: 4, text: 'Haha tell me about it. Want to study together?', sent: true, time: '10:35 AM' },
      { id: 5, text: 'Yes! Library at 6?', sent: false, time: '10:36 AM' },
      { id: 6, text: 'Perfect, see you there 👍', sent: true, time: '10:37 AM' },
      { id: 7, text: 'Hey! Are you coming to the fest tonight?', sent: false, time: '5:42 PM' },
    ],
  },
  {
    id: 'conv-2',
    user: { fullName: 'Arjun Kumar', username: 'arjun' },
    online: false,
    unread: false,
    lastMessage: 'Thanks for the notes!',
    lastTime: '1h ago',
    messages: [
      { id: 1, text: 'Bro can you share the ML notes?', sent: false, time: '9:15 AM' },
      { id: 2, text: 'Sure, let me find them', sent: true, time: '9:20 AM' },
      { id: 3, text: 'Here you go, check the drive link', sent: true, time: '9:22 AM' },
      { id: 4, text: 'Thanks for the notes!', sent: false, time: '9:25 AM' },
    ],
  },
  {
    id: 'conv-3',
    user: { fullName: 'Sneha Patel', username: 'sneha' },
    online: true,
    unread: true,
    lastMessage: 'Check out this meme 😂',
    lastTime: '3h ago',
    messages: [
      { id: 1, text: 'Have you tried the new cafeteria menu?', sent: false, time: '12:00 PM' },
      { id: 2, text: 'Not yet! Is it good?', sent: true, time: '12:05 PM' },
      { id: 3, text: 'SO good. The dosa is amazing 🤤', sent: false, time: '12:06 PM' },
      { id: 4, text: 'Okay I need to try it tomorrow', sent: true, time: '12:08 PM' },
      { id: 5, text: 'Check out this meme 😂', sent: false, time: '2:30 PM' },
    ],
  },
  {
    id: 'conv-4',
    user: { fullName: 'Rahul Verma', username: 'rahul' },
    online: false,
    unread: false,
    lastMessage: 'See you at the hackathon!',
    lastTime: '1d ago',
    messages: [
      { id: 1, text: 'Are you joining the hackathon this weekend?', sent: false, time: 'Yesterday, 4:00 PM' },
      { id: 2, text: 'Definitely! Want to team up?', sent: true, time: 'Yesterday, 4:15 PM' },
      { id: 3, text: 'Yes! I\'ll bring the snacks 🍕', sent: false, time: 'Yesterday, 4:16 PM' },
      { id: 4, text: 'Haha deal. See you at the hackathon!', sent: true, time: 'Yesterday, 4:18 PM' },
      { id: 5, text: 'See you at the hackathon!', sent: false, time: 'Yesterday, 4:20 PM' },
    ],
  },
]

function MessagesPage() {
  const [activeConvo, setActiveConvo] = useState(MOCK_CONVERSATIONS[0].id)
  const [messageInput, setMessageInput] = useState('')
  const [conversations, setConversations] = useState(MOCK_CONVERSATIONS)
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileShowChat, setMobileShowChat] = useState(false)
  const messagesEndRef = useRef(null)

  const currentConvo = conversations.find((c) => c.id === activeConvo)

  const filteredConversations = searchQuery
    ? conversations.filter((c) =>
        c.user.fullName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentConvo?.messages.length])

  const handleSend = () => {
    if (!messageInput.trim() || !currentConvo) return

    const newMessage = {
      id: Date.now(),
      text: messageInput.trim(),
      sent: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvo
          ? {
              ...c,
              messages: [...c.messages, newMessage],
              lastMessage: newMessage.text,
              lastTime: 'Just now',
            }
          : c
      )
    )
    setMessageInput('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const selectConversation = (id) => {
    setActiveConvo(id)
    setMobileShowChat(true)
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread: false } : c))
    )
  }

  return (
    <div className="messages-page">
      {/* ── Conversation List ──────────────────────────── */}
      <div className={`messages-sidebar${mobileShowChat ? ' hidden-mobile' : ''}`}>
        <div className="messages-sidebar-header">
          <h2 className="messages-sidebar-title">Messages</h2>
          <input
            type="text"
            className="messages-search"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="conversations-list">
          {filteredConversations.map((convo) => (
            <div
              key={convo.id}
              className={`conversation-item${convo.id === activeConvo ? ' active' : ''}`}
              onClick={() => selectConversation(convo.id)}
            >
              <div className="conversation-avatar">
                {getInitials(convo.user.fullName)}
                {convo.online && <span className="conversation-online" />}
              </div>
              <div className="conversation-info">
                <div className="conversation-name">{convo.user.fullName}</div>
                <div className="conversation-preview">{convo.lastMessage}</div>
              </div>
              <div className="conversation-meta">
                <span className="conversation-time">{convo.lastTime}</span>
                {convo.unread && <span className="conversation-unread" />}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Chat Area ──────────────────────────────────── */}
      {currentConvo ? (
        <div className={`chat-area${!mobileShowChat ? ' hidden-mobile' : ''}`}>
          <div className="chat-header">
            <button
              className="chat-back-btn"
              onClick={() => setMobileShowChat(false)}
            >
              ←
            </button>
            <div className="chat-header-avatar">
              {getInitials(currentConvo.user.fullName)}
            </div>
            <div className="chat-header-info">
              <div className="chat-header-name">{currentConvo.user.fullName}</div>
              <div className={`chat-header-status${currentConvo.online ? '' : ' offline'}`}>
                {currentConvo.online ? 'Online' : 'Offline'}
              </div>
            </div>
          </div>

          <div className="chat-messages">
            <div className="chat-date-divider">Today</div>
            {currentConvo.messages.map((msg) => (
              <div key={msg.id}>
                <div className={`chat-message ${msg.sent ? 'sent' : 'received'}`}>
                  <div className="chat-bubble">{msg.text}</div>
                </div>
                <div className={`chat-message-time${msg.sent ? ' sent' : ''}`} style={{ textAlign: msg.sent ? 'right' : 'left' }}>
                  {msg.time}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-area">
            <button className="chat-attach-btn" title="Attach file">📎</button>
            <input
              type="text"
              className="chat-input"
              placeholder="Type a message..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              className="chat-send-btn"
              onClick={handleSend}
              disabled={!messageInput.trim()}
              title="Send"
            >
              ↑
            </button>
          </div>
        </div>
      ) : (
        <div className="chat-area">
          <div className="chat-empty">
            <div className="chat-empty-icon">💬</div>
            <p>Select a conversation to start messaging</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default MessagesPage
