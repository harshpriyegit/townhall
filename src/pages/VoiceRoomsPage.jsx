import { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../utils/socket';
import { useAuth } from '../context/AuthContext';
import '../styles/voice-rooms.css';

const TOPICS = ['Late Night Talks', 'Confessions', 'College Gossip', 'Random Vibes', 'Music Jam', 'Study Break'];

const MOCK_ROOMS = [
  { id: 'mock-1', name: 'Late Night Talks', topic: 'Chill', participants: 12, duration: '23m ago', speaking: [true, false, true, false, false] },
  { id: 'mock-2', name: 'Confessions Hour', topic: 'Confessions', participants: 27, duration: '1h 15m ago', speaking: [false, true, false, true, false, false, true] },
  { id: 'mock-3', name: 'Campus Gossip Weekly', topic: 'Gossip', participants: 8, duration: '45m ago', speaking: [true, false, false] },
  { id: 'mock-4', name: 'Midnight Music Jam', topic: 'Music', participants: 15, duration: '32m ago', speaking: [false, false, true, true] },
  { id: 'mock-5', name: 'Random Vibes Only', topic: 'Random', participants: 5, duration: '10m ago', speaking: [true, false] },
  { id: 'mock-6', name: 'Exam Stress Vent', topic: 'Study Break', participants: 19, duration: '2h ago', speaking: [false, true, false, false, true, false] },
];

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function VoiceRoomsPage() {
  const { currentUser } = useAuth();
  const myId = currentUser?._id || currentUser?.id || 'me';
  const myName = currentUser?.fullName || currentUser?.username || 'Anonymous';

  // UI state
  const [showModal, setShowModal] = useState(false);
  const [joinedRoom, setJoinedRoom] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomTopic, setRoomTopic] = useState(TOPICS[0]);
  const [rooms, setRooms] = useState(MOCK_ROOMS);
  const [participants, setParticipants] = useState([]);
  const [mediaError, setMediaError] = useState('');

  // Refs for WebRTC
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({}); // { socketId: RTCPeerConnection }
  const remoteAudioRef = useRef({}); // { socketId: HTMLAudioElement }

  // ── Fetch rooms on mount ──────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    if (!socket.connected) return;

    socket.emit('voice:get-rooms');

    const handleRooms = (data) => {
      if (Array.isArray(data) && data.length > 0) {
        setRooms([...data, ...MOCK_ROOMS]);
      }
    };

    socket.on('voice:rooms', handleRooms);
    return () => {
      socket.off('voice:rooms', handleRooms);
    };
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────
  useEffect(() => {
    return () => {
      cleanupRoom();
    };
  }, []);

  const cleanupRoom = useCallback(() => {
    // Stop local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    // Close all peer connections
    Object.values(peerConnectionsRef.current).forEach((pc) => {
      try { pc.close(); } catch (e) { /* ignore */ }
    });
    peerConnectionsRef.current = {};

    // Remove audio elements
    Object.values(remoteAudioRef.current).forEach((audio) => {
      try {
        audio.pause();
        audio.srcObject = null;
        audio.remove();
      } catch (e) { /* ignore */ }
    });
    remoteAudioRef.current = {};
  }, []);

  // ── Create a peer connection ─────────────────────────────
  const createPeerConnection = useCallback((targetSocketId) => {
    const socket = socketRef.current;
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local audio tracks
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // ICE candidate
    pc.onicecandidate = (event) => {
      if (event.candidate && socket?.connected) {
        socket.emit('voice:ice-candidate', {
          targetSocketId,
          candidate: event.candidate,
        });
      }
    };

    // Remote stream
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        let audio = remoteAudioRef.current[targetSocketId];
        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          remoteAudioRef.current[targetSocketId] = audio;
        }
        audio.srcObject = remoteStream;
      }
    };

    peerConnectionsRef.current[targetSocketId] = pc;
    return pc;
  }, []);

  // ── Socket listeners for active room ──────────────────────
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected || !joinedRoom) return;

    const handleParticipants = (data) => {
      setParticipants(Array.isArray(data) ? data : []);
    };

    const handleParticipantJoined = async (data) => {
      const { socketId } = data;
      if (!socketId) return;

      // Create offer for new participant
      try {
        const pc = createPeerConnection(socketId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('voice:offer', { targetSocketId: socketId, offer });
      } catch (err) {
        console.error('Error creating offer:', err);
      }

      // Update participants
      setParticipants((prev) => {
        if (prev.find((p) => p.socketId === socketId)) return prev;
        return [...prev, {
          socketId,
          userId: data.userId,
          username: data.username || 'Anonymous',
          muted: false,
          handRaised: false,
        }];
      });
    };

    const handleOffer = async (data) => {
      const { senderSocketId, offer } = data;
      if (!senderSocketId) return;

      try {
        const pc = createPeerConnection(senderSocketId);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('voice:answer', { targetSocketId: senderSocketId, answer });
      } catch (err) {
        console.error('Error handling offer:', err);
      }
    };

    const handleAnswer = async (data) => {
      const { senderSocketId, answer } = data;
      const pc = peerConnectionsRef.current[senderSocketId];
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error('Error setting remote description:', err);
        }
      }
    };

    const handleIceCandidate = async (data) => {
      const { senderSocketId, candidate } = data;
      const pc = peerConnectionsRef.current[senderSocketId];
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      }
    };

    const handleParticipantLeft = (data) => {
      const { socketId } = data;

      // Close peer connection
      const pc = peerConnectionsRef.current[socketId];
      if (pc) {
        pc.close();
        delete peerConnectionsRef.current[socketId];
      }

      // Remove audio
      const audio = remoteAudioRef.current[socketId];
      if (audio) {
        audio.pause();
        audio.srcObject = null;
        audio.remove();
        delete remoteAudioRef.current[socketId];
      }

      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
    };

    const handleMuteChanged = (data) => {
      const { socketId, muted } = data;
      setParticipants((prev) =>
        prev.map((p) => (p.socketId === socketId ? { ...p, muted } : p))
      );
    };

    const handleHandChanged = (data) => {
      const { socketId, handRaised: raised } = data;
      setParticipants((prev) =>
        prev.map((p) => (p.socketId === socketId ? { ...p, handRaised: raised } : p))
      );
    };

    socket.on('voice:participants', handleParticipants);
    socket.on('voice:participant-joined', handleParticipantJoined);
    socket.on('voice:offer', handleOffer);
    socket.on('voice:answer', handleAnswer);
    socket.on('voice:ice-candidate', handleIceCandidate);
    socket.on('voice:participant-left', handleParticipantLeft);
    socket.on('voice:mute-changed', handleMuteChanged);
    socket.on('voice:hand-changed', handleHandChanged);

    return () => {
      socket.off('voice:participants', handleParticipants);
      socket.off('voice:participant-joined', handleParticipantJoined);
      socket.off('voice:offer', handleOffer);
      socket.off('voice:answer', handleAnswer);
      socket.off('voice:ice-candidate', handleIceCandidate);
      socket.off('voice:participant-left', handleParticipantLeft);
      socket.off('voice:mute-changed', handleMuteChanged);
      socket.off('voice:hand-changed', handleHandChanged);
    };
  }, [joinedRoom, createPeerConnection]);

  // ── Join room ─────────────────────────────────────────────
  const handleJoin = async (room) => {
    setMediaError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Start muted by default
      stream.getAudioTracks().forEach((t) => { t.enabled = false; });
      localStreamRef.current = stream;
    } catch (err) {
      console.error('Microphone access denied:', err);
      setMediaError('Microphone access denied. Please allow mic access in your browser settings.');
      return;
    }

    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit('voice:join', { roomId: room.id, userId: myId, username: myName });
    }

    setJoinedRoom(room);
    setIsMuted(true);
    setHandRaised(false);

    // Add self to participants
    setParticipants([{
      socketId: 'self',
      userId: myId,
      username: myName + ' (You)',
      muted: true,
      handRaised: false,
    }]);
  };

  // ── Leave room ─────────────────────────────────────────────
  const handleLeave = () => {
    const socket = socketRef.current;
    if (socket?.connected && joinedRoom) {
      socket.emit('voice:leave', { roomId: joinedRoom.id });
    }

    cleanupRoom();
    setJoinedRoom(null);
    setIsMuted(true);
    setHandRaised(false);
    setParticipants([]);
    setMediaError('');
  };

  // ── Toggle mute ────────────────────────────────────────────
  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !newMuted;
      });
    }

    const socket = socketRef.current;
    if (socket?.connected && joinedRoom) {
      socket.emit('voice:toggle-mute', { roomId: joinedRoom.id, muted: newMuted });
    }

    // Update self in participants
    setParticipants((prev) =>
      prev.map((p) => (p.socketId === 'self' ? { ...p, muted: newMuted } : p))
    );
  };

  // ── Toggle hand ────────────────────────────────────────────
  const toggleHand = () => {
    const newHand = !handRaised;
    setHandRaised(newHand);

    const socket = socketRef.current;
    if (socket?.connected && joinedRoom) {
      socket.emit('voice:toggle-hand', { roomId: joinedRoom.id });
    }

    setParticipants((prev) =>
      prev.map((p) => (p.socketId === 'self' ? { ...p, handRaised: newHand } : p))
    );
  };

  // ── Create room ───────────────────────────────────────────
  const handleCreate = () => {
    if (!roomName.trim()) return;

    const roomId = 'room-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const socket = socketRef.current;

    if (socket?.connected) {
      socket.emit('voice:create', { roomId, roomName: roomName.trim(), topic: roomTopic });
    }

    const newRoom = {
      id: roomId,
      name: roomName.trim(),
      topic: roomTopic,
      participants: 0,
      duration: 'Just now',
      speaking: [],
    };

    setRooms((prev) => [newRoom, ...prev]);
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

        {mediaError && (
          <div className="vr-media-error">
            <span>⚠️</span> {mediaError}
          </div>
        )}

        {joinedRoom ? (
          /* ── Active Room View ──────────────────────────── */
          <div className="vr-active-room">
            <div className="vr-active-header">
              <h2 className="vr-active-name">{joinedRoom.name}</h2>
              <p className="vr-active-topic">{joinedRoom.topic}</p>
              <p className="vr-active-count">{participants.length} participant{participants.length !== 1 ? 's' : ''}</p>
            </div>

            <div className="vr-participants-grid">
              {participants.map((p) => (
                <div key={p.socketId} className="vr-participant-circle">
                  <div className={`vr-participant-avatar${!p.muted ? ' speaking' : ''}`}>
                    👤
                    <span className="vr-mic-icon">{p.muted ? '🔇' : '🎤'}</span>
                  </div>
                  <span className="vr-participant-label">
                    {p.username || `Anon #${p.socketId.slice(-4)}`}
                  </span>
                  {p.handRaised && <span className="vr-hand-icon">✋</span>}
                </div>
              ))}
            </div>

            <div className="vr-active-controls">
              <button
                className={`vr-control-btn ${!isMuted ? 'active' : ''}`}
                onClick={toggleMute}
              >
                {isMuted ? '🔇 Muted' : '🎤 Unmute'}
              </button>
              <button
                className={`vr-control-btn ${handRaised ? 'active' : ''}`}
                onClick={toggleHand}
              >
                ✋ {handRaised ? 'Hand Raised' : 'Raise Hand'}
              </button>
              <button className="vr-control-btn leave" onClick={handleLeave}>
                Leave Room
              </button>
            </div>
          </div>
        ) : (
          /* ── Room Grid ────────────────────────────────── */
          <div className="vr-grid">
            {rooms.map((room) => (
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
                    {(room.speaking || []).slice(0, 4).map((_, i) => (
                      <div key={i} className="vr-participant-dot">👤</div>
                    ))}
                    {(room.participantCount || room.participants || 0) > 4 && (
                      <div className="vr-participant-dot">+{(room.participantCount || room.participants) - 4}</div>
                    )}
                  </div>
                  <span className="vr-participant-count">
                    {room.participantCount || room.participants || 0} people
                  </span>
                </div>
                <div className="vr-room-bottom">
                  <span className="vr-room-duration">Started {room.duration || 'recently'}</span>
                  <button className="vr-join-btn" onClick={() => handleJoin(room)}>
                    Join
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Create Modal ───────────────────────────────── */}
        {showModal && (
          <div className="vr-modal-overlay" onClick={() => setShowModal(false)}>
            <div className="vr-modal" onClick={(e) => e.stopPropagation()}>
              <h2>Create a Voice Room</h2>
              <div className="vr-modal-field">
                <label>Room Name</label>
                <input
                  type="text"
                  placeholder="Enter room name..."
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                />
              </div>
              <div className="vr-modal-field">
                <label>Topic</label>
                <select value={roomTopic} onChange={(e) => setRoomTopic(e.target.value)}>
                  {TOPICS.map((t) => (
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
