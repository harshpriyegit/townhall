import { useState } from 'react';
import '../styles/voice-rooms.css';

const TOPICS = ['Late Night Talks', 'Confessions', 'College Gossip', 'Random Vibes', 'Music Jam', 'Study Break'];

const MOCK_ROOMS = [
  { id: 1, name: 'Late Night Talks', topic: 'Chill', participants: 12, duration: '23m ago', speaking: [true, false, true, false, false] },
  { id: 2, name: 'Confessions Hour', topic: 'Confessions', participants: 27, duration: '1h 15m ago', speaking: [false, true, false, true, false, false, true] },
  { id: 3, name: 'Campus Gossip Weekly', topic: 'Gossip', participants: 8, duration: '45m ago', speaking: [true, false, false] },
  { id: 4, name: 'Midnight Music Jam', topic: 'Music', participants: 15, duration: '32m ago', speaking: [false, false, true, true] },
  { id: 5, name: 'Random Vibes Only', topic: 'Random', participants: 5, duration: '10m ago', speaking: [true, false] },
  { id: 6, name: 'Exam Stress Vent', topic: 'Study Break', participants: 19, duration: '2h ago', speaking: [false, true, false, false, true, false] },
];

const ACTIVE_PARTICIPANTS = [
  { id: 1, speaking: true, muted: false },
  { id: 2, speaking: false, muted: true },
  { id: 3, speaking: true, muted: false },
  { id: 4, speaking: false, muted: false },
  { id: 5, speaking: false, muted: true },
  { id: 6, speaking: false, muted: true },
  { id: 7, speaking: true, muted: false },
  { id: 8, speaking: false, muted: true },
];

export default function VoiceRoomsPage() {
  const [showModal, setShowModal] = useState(false);
  const [joinedRoom, setJoinedRoom] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomTopic, setRoomTopic] = useState(TOPICS[0]);

  const handleJoin = (room) => {
    setJoinedRoom(room);
  };

  const handleLeave = () => {
    setJoinedRoom(null);
    setIsMuted(true);
    setHandRaised(false);
  };

  const handleCreate = () => {
    if (!roomName.trim()) return;
    setShowModal(false);
    setRoomName('');
    setRoomTopic(TOPICS[0]);
  };

  return (
    <div className="voice-rooms-page">
      <div className="voice-rooms-container">
        <header className="vr-header">
          <h1>🎙️ Voice Rooms</h1>
          <p>Join anonymous conversations</p>
          <div className="vr-actions">
            <button className="vr-create-btn" onClick={() => setShowModal(true)}>
              ＋ Create Room
            </button>
          </div>
        </header>

        {joinedRoom ? (
          /* Active Room View */
          <div className="vr-active-room">
            <div className="vr-active-header">
              <h2 className="vr-active-name">{joinedRoom.name}</h2>
              <p className="vr-active-topic">{joinedRoom.topic}</p>
              <p className="vr-active-count">{ACTIVE_PARTICIPANTS.length} participants</p>
            </div>

            <div className="vr-participants-grid">
              {ACTIVE_PARTICIPANTS.map(p => (
                <div key={p.id} className="vr-participant-circle">
                  <div className={`vr-participant-avatar ${p.speaking ? 'speaking' : ''}`}>
                    👤
                    <span className="vr-mic-icon">{p.muted ? '🔇' : '🎤'}</span>
                  </div>
                  <span className="vr-participant-label">Anon #{p.id}</span>
                </div>
              ))}
            </div>

            <div className="vr-active-controls">
              <button
                className={`vr-control-btn ${!isMuted ? 'active' : ''}`}
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? '🔇 Muted' : '🎤 Unmute'}
              </button>
              <button
                className={`vr-control-btn ${handRaised ? 'active' : ''}`}
                onClick={() => setHandRaised(!handRaised)}
              >
                ✋ {handRaised ? 'Hand Raised' : 'Raise Hand'}
              </button>
              <button className="vr-control-btn leave" onClick={handleLeave}>
                Leave Room
              </button>
            </div>
          </div>
        ) : (
          /* Room Grid */
          <div className="vr-grid">
            {MOCK_ROOMS.map(room => (
              <div key={room.id} className="vr-room-card">
                <div className="vr-room-top">
                  <span className="vr-room-name">{room.name}</span>
                  <span className="vr-live-badge">
                    <span className="vr-live-dot" />
                    Live
                  </span>
                </div>
                <span className="vr-topic-badge">{room.topic}</span>
                <div className="vr-room-participants">
                  <div className="vr-participant-avatars">
                    {room.speaking.slice(0, 4).map((_, i) => (
                      <div key={i} className="vr-participant-dot">👤</div>
                    ))}
                    {room.participants > 4 && (
                      <div className="vr-participant-dot">+{room.participants - 4}</div>
                    )}
                  </div>
                  <span className="vr-participant-count">{room.participants} people</span>
                </div>
                <div className="vr-room-bottom">
                  <span className="vr-room-duration">Started {room.duration}</span>
                  <button className="vr-join-btn" onClick={() => handleJoin(room)}>
                    Join
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showModal && (
          <div className="vr-modal-overlay" onClick={() => setShowModal(false)}>
            <div className="vr-modal" onClick={e => e.stopPropagation()}>
              <h2>Create a Voice Room</h2>
              <div className="vr-modal-field">
                <label>Room Name</label>
                <input
                  type="text"
                  placeholder="Enter room name..."
                  value={roomName}
                  onChange={e => setRoomName(e.target.value)}
                />
              </div>
              <div className="vr-modal-field">
                <label>Topic</label>
                <select value={roomTopic} onChange={e => setRoomTopic(e.target.value)}>
                  {TOPICS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="vr-modal-actions">
                <button className="vr-modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="vr-modal-submit" onClick={handleCreate}>Create Room</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
