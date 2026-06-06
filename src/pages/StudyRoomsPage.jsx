import { useState } from 'react';
import '../styles/study-rooms.css';

const MOCK_ROOMS = [
  { id: 1, name: 'DSA Prep', subject: 'Computer Science', host: 'Aditya K.', current: 6, max: 8, duration: '1h 23m', features: ['📹', '🖥️', '📝'] },
  { id: 2, name: 'Physics Lab Review', subject: 'Physics', host: 'Meera S.', current: 3, max: 6, duration: '45m', features: ['📹', '📝'] },
  { id: 3, name: 'Math Revision', subject: 'Mathematics', host: 'Rohan P.', current: 8, max: 8, duration: '2h 10m', features: ['🖥️', '📝'] },
  { id: 4, name: 'Web Dev Sprint', subject: 'IT', host: 'Kavya R.', current: 4, max: 10, duration: '32m', features: ['📹', '🖥️', '📝'] },
  { id: 5, name: 'Organic Chem', subject: 'Chemistry', host: 'Nikhil D.', current: 2, max: 5, duration: '15m', features: ['📹', '📝'] },
  { id: 6, name: 'Machine Learning', subject: 'AI/ML', host: 'Priya M.', current: 7, max: 8, duration: '1h 45m', features: ['📹', '🖥️'] },
];

const CHAT_MESSAGES = [
  { name: 'Aditya', text: 'Can someone explain binary trees?' },
  { name: 'Meera', text: 'Check page 142 in the textbook' },
  { name: 'Rohan', text: 'I think we should focus on graphs next' },
  { name: 'Kavya', text: 'Great session so far! 🙌' },
];

const VIDEO_PARTICIPANTS = [
  { initials: 'AK', name: 'Aditya K.', muted: false },
  { initials: 'MS', name: 'Meera S.', muted: true },
  { initials: 'RP', name: 'Rohan P.', muted: false },
  { initials: 'KR', name: 'Kavya R.', muted: true },
];

const FEATURE_LABELS = { '📹': 'Video', '🖥️': 'Screen Share', '📝': 'Whiteboard' };

export default function StudyRoomsPage() {
  const [joinedRoom, setJoinedRoom] = useState(null);
  const [chatMsg, setChatMsg] = useState('');
  const [cam, setCam] = useState(true);
  const [mic, setMic] = useState(true);

  return (
    <div className="study-rooms-page">
      <div className="study-rooms-container">
        <header className="sr-header">
          <h1>📚 Study Rooms</h1>
          <p>Focus together, learn better</p>
          <div className="sr-actions">
            <button className="sr-create-btn">＋ Create Room</button>
          </div>
        </header>

        {joinedRoom ? (
          <div className="sr-active-room">
            <div className="sr-active-header">
              <div>
                <h2 className="sr-active-title">{joinedRoom.name}</h2>
                <p className="sr-active-info">{joinedRoom.subject} · Hosted by {joinedRoom.host}</p>
              </div>
              <span className="sr-active-info">{VIDEO_PARTICIPANTS.length} students</span>
            </div>

            <div className="sr-active-body">
              <div className="sr-video-grid">
                {VIDEO_PARTICIPANTS.map((p, i) => (
                  <div key={i} className="sr-video-tile">
                    <div className="sr-video-initials">{p.initials}</div>
                    <span className="sr-video-name">{p.name}</span>
                    <span className="sr-video-mic">{p.muted ? '🔇' : '🎤'}</span>
                  </div>
                ))}
              </div>

              <div className="sr-chat-panel">
                <div className="sr-chat-header">Room Chat</div>
                <div className="sr-chat-messages">
                  {CHAT_MESSAGES.map((msg, i) => (
                    <div key={i} className="sr-chat-msg">
                      <span className="sr-chat-msg-name">{msg.name}</span>
                      <span className="sr-chat-msg-text">{msg.text}</span>
                    </div>
                  ))}
                </div>
                <div className="sr-chat-input">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={chatMsg}
                    onChange={e => setChatMsg(e.target.value)}
                  />
                  <button className="sr-chat-send" onClick={() => setChatMsg('')}>Send</button>
                </div>
              </div>
            </div>

            <div className="sr-active-controls">
              <button className={`sr-ctrl-btn ${cam ? 'active' : ''}`} onClick={() => setCam(!cam)}>
                📹 {cam ? 'Cam On' : 'Cam Off'}
              </button>
              <button className={`sr-ctrl-btn ${mic ? 'active' : ''}`} onClick={() => setMic(!mic)}>
                🎤 {mic ? 'Mic On' : 'Mic Off'}
              </button>
              <button className="sr-ctrl-btn">🖥️ Share Screen</button>
              <button className="sr-ctrl-btn leave" onClick={() => setJoinedRoom(null)}>
                Leave Room
              </button>
            </div>
          </div>
        ) : (
          <div className="sr-grid">
            {MOCK_ROOMS.map(room => {
              const isFull = room.current >= room.max;
              const fillPercent = (room.current / room.max) * 100;
              return (
                <div key={room.id} className="sr-room-card">
                  <div className="sr-room-top">
                    <span className="sr-room-name">{room.name}</span>
                    <span className="sr-subject-badge">{room.subject}</span>
                  </div>
                  <p className="sr-host">Hosted by <strong>{room.host}</strong></p>

                  <div className="sr-capacity">
                    <div className="sr-capacity-text">
                      <span className="sr-capacity-label">{room.current}/{room.max} students</span>
                      <span className="sr-capacity-count">{isFull ? 'Full' : `${room.max - room.current} spots left`}</span>
                    </div>
                    <div className="sr-progress-bar">
                      <div
                        className={`sr-progress-fill ${isFull ? 'full' : fillPercent > 75 ? 'almost-full' : ''}`}
                        style={{ width: `${fillPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="sr-features">
                    {room.features.map(f => (
                      <span key={f} className="sr-feature-icon">{f} {FEATURE_LABELS[f]}</span>
                    ))}
                  </div>

                  <div className="sr-room-bottom">
                    <span className="sr-duration">{room.duration} active</span>
                    <button
                      className="sr-join-btn"
                      disabled={isFull}
                      onClick={() => !isFull && setJoinedRoom(room)}
                    >
                      {isFull ? 'Full' : 'Join'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
