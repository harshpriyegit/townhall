import { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../utils/socket';
import { useAuth } from '../context/AuthContext';
import '../styles/study-rooms.css';

const MOCK_ROOMS = [
  { id: 'mock-sr-1', name: 'DSA Prep', subject: 'Computer Science', host: 'Aditya K.', current: 6, max: 8, duration: '1h 23m', features: ['📹', '🖥️', '📝'] },
  { id: 'mock-sr-2', name: 'Physics Lab Review', subject: 'Physics', host: 'Meera S.', current: 3, max: 6, duration: '45m', features: ['📹', '📝'] },
  { id: 'mock-sr-3', name: 'Math Revision', subject: 'Mathematics', host: 'Rohan P.', current: 8, max: 8, duration: '2h 10m', features: ['🖥️', '📝'] },
  { id: 'mock-sr-4', name: 'Web Dev Sprint', subject: 'IT', host: 'Kavya R.', current: 4, max: 10, duration: '32m', features: ['📹', '🖥️', '📝'] },
  { id: 'mock-sr-5', name: 'Organic Chem', subject: 'Chemistry', host: 'Nikhil D.', current: 2, max: 5, duration: '15m', features: ['📹', '📝'] },
  { id: 'mock-sr-6', name: 'Machine Learning', subject: 'AI/ML', host: 'Priya M.', current: 7, max: 8, duration: '1h 45m', features: ['📹', '🖥️'] },
];

const FEATURE_LABELS = { '📹': 'Video', '🖥️': 'Screen Share', '📝': 'Whiteboard' };

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function StudyRoomsPage() {
  const { currentUser } = useAuth();
  const myId = currentUser?._id || currentUser?.id || 'me';
  const myName = currentUser?.fullName || currentUser?.username || 'Anonymous';

  // UI state
  const [joinedRoom, setJoinedRoom] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [rooms, setRooms] = useState(MOCK_ROOMS);
  const [cam, setCam] = useState(true);
  const [mic, setMic] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatMsg, setChatMsg] = useState('');
  const [showChat, setShowChat] = useState(true);
  const [remoteStreams, setRemoteStreams] = useState({}); // { socketId: { stream, username, muted, camOff } }
  const [mediaError, setMediaError] = useState('');

  // Create modal state
  const [createName, setCreateName] = useState('');
  const [createSubject, setCreateSubject] = useState('');
  const [createMax, setCreateMax] = useState(8);

  // Refs
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const chatEndRef = useRef(null);

  // ── Fetch rooms on mount ──────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    if (!socket.connected) return;

    socket.emit('video:get-rooms');

    const handleRooms = (data) => {
      if (Array.isArray(data) && data.length > 0) {
        setRooms([...data, ...MOCK_ROOMS]);
      }
    };

    socket.on('video:rooms', handleRooms);
    return () => {
      socket.off('video:rooms', handleRooms);
    };
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────
  useEffect(() => {
    return () => { cleanupRoom(); };
  }, []);

  // ── Auto-scroll chat ──────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  const cleanupRoom = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    Object.values(peerConnectionsRef.current).forEach((pc) => {
      try { pc.close(); } catch (e) { /* ignore */ }
    });
    peerConnectionsRef.current = {};
    setRemoteStreams({});
  }, []);

  // ── Create a peer connection (video + audio) ─────────────
  const createPeerConnection = useCallback((targetSocketId, username) => {
    const socket = socketRef.current;
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // ICE candidate
    pc.onicecandidate = (event) => {
      if (event.candidate && socket?.connected) {
        socket.emit('video:ice-candidate', {
          targetSocketId,
          candidate: event.candidate,
        });
      }
    };

    // Remote stream
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        setRemoteStreams((prev) => ({
          ...prev,
          [targetSocketId]: {
            stream: remoteStream,
            username: username || 'Anonymous',
            muted: false,
            camOff: false,
          },
        }));
      }
    };

    peerConnectionsRef.current[targetSocketId] = pc;
    return pc;
  }, []);

  // ── Socket listeners for active room ──────────────────────
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected || !joinedRoom) return;

    const handleParticipantJoined = async (data) => {
      const { socketId, username } = data;
      if (!socketId) return;

      try {
        const pc = createPeerConnection(socketId, username);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('video:offer', { targetSocketId: socketId, offer });
      } catch (err) {
        console.error('Error creating offer:', err);
      }
    };

    const handleOffer = async (data) => {
      const { senderSocketId, offer, username } = data;
      if (!senderSocketId) return;

      try {
        const pc = createPeerConnection(senderSocketId, username);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('video:answer', { targetSocketId: senderSocketId, answer });
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
          console.error('Error setting remote desc:', err);
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
      const pc = peerConnectionsRef.current[socketId];
      if (pc) {
        pc.close();
        delete peerConnectionsRef.current[socketId];
      }
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    };

    const handleToggleMedia = (data) => {
      const { socketId, type, enabled } = data;
      setRemoteStreams((prev) => {
        const entry = prev[socketId];
        if (!entry) return prev;
        return {
          ...prev,
          [socketId]: {
            ...entry,
            muted: type === 'audio' ? !enabled : entry.muted,
            camOff: type === 'video' ? !enabled : entry.camOff,
          },
        };
      });
    };

    const handleScreenShare = (data) => {
      // Could update UI to show screen share indicator
    };

    const handleChatMessage = (data) => {
      setChatMessages((prev) => [
        ...prev,
        { name: data.username || 'Anonymous', text: data.content, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      ]);
    };

    socket.on('video:participant-joined', handleParticipantJoined);
    socket.on('video:offer', handleOffer);
    socket.on('video:answer', handleAnswer);
    socket.on('video:ice-candidate', handleIceCandidate);
    socket.on('video:participant-left', handleParticipantLeft);
    socket.on('video:toggle-media', handleToggleMedia);
    socket.on('video:screen-share', handleScreenShare);
    socket.on('video:chat-message', handleChatMessage);

    return () => {
      socket.off('video:participant-joined', handleParticipantJoined);
      socket.off('video:offer', handleOffer);
      socket.off('video:answer', handleAnswer);
      socket.off('video:ice-candidate', handleIceCandidate);
      socket.off('video:participant-left', handleParticipantLeft);
      socket.off('video:toggle-media', handleToggleMedia);
      socket.off('video:screen-share', handleScreenShare);
      socket.off('video:chat-message', handleChatMessage);
    };
  }, [joinedRoom, createPeerConnection]);

  // ── Attach local stream to video element ──────────────────
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [joinedRoom]);

  // ── Join room ─────────────────────────────────────────────
  const handleJoin = async (room) => {
    if (room.current >= room.max) return;
    setMediaError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      localStreamRef.current = stream;
    } catch (err) {
      console.error('Camera/Mic access denied:', err);
      setMediaError('Camera or microphone access denied. Please allow access in your browser settings.');
      return;
    }

    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit('video:join', { roomId: room.id, userId: myId, username: myName });
    }

    setJoinedRoom(room);
    setCam(true);
    setMic(true);
    setIsScreenSharing(false);
    setChatMessages([
      { name: 'System', text: `Welcome to ${room.name}!`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    ]);

    // Set local video after state update
    setTimeout(() => {
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    }, 100);
  };

  // ── Leave room ─────────────────────────────────────────────
  const handleLeave = () => {
    const socket = socketRef.current;
    if (socket?.connected && joinedRoom) {
      socket.emit('video:leave', { roomId: joinedRoom.id });
    }
    cleanupRoom();
    setJoinedRoom(null);
    setCam(true);
    setMic(true);
    setIsScreenSharing(false);
    setChatMessages([]);
    setMediaError('');
  };

  // ── Toggle camera ─────────────────────────────────────────
  const toggleCamera = () => {
    const newCam = !cam;
    setCam(newCam);

    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = newCam;
      });
    }

    const socket = socketRef.current;
    if (socket?.connected && joinedRoom) {
      socket.emit('video:toggle-media', { roomId: joinedRoom.id, type: 'video', enabled: newCam });
    }
  };

  // ── Toggle mic ─────────────────────────────────────────────
  const toggleMic = () => {
    const newMic = !mic;
    setMic(newMic);

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = newMic;
      });
    }

    const socket = socketRef.current;
    if (socket?.connected && joinedRoom) {
      socket.emit('video:toggle-media', { roomId: joinedRoom.id, type: 'audio', enabled: newMic });
    }
  };

  // ── Screen share ──────────────────────────────────────────
  const toggleScreenShare = async () => {
    const socket = socketRef.current;

    if (isScreenSharing) {
      // Stop screen share, restore camera
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }

      // Restore camera track in peer connections
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          Object.values(peerConnectionsRef.current).forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) sender.replaceTrack(videoTrack);
          });
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
      }

      setIsScreenSharing(false);
      if (socket?.connected && joinedRoom) {
        socket.emit('video:screen-share', { roomId: joinedRoom.id, sharing: false });
      }
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        // Replace video track in peer connections
        Object.values(peerConnectionsRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        });

        // Show screen in local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        // When user stops sharing via browser UI
        screenTrack.onended = () => {
          toggleScreenShare();
        };

        setIsScreenSharing(true);
        if (socket?.connected && joinedRoom) {
          socket.emit('video:screen-share', { roomId: joinedRoom.id, sharing: true });
        }
      } catch (err) {
        console.error('Screen share error:', err);
      }
    }
  };

  // ── Send chat message ─────────────────────────────────────
  const sendChat = () => {
    if (!chatMsg.trim()) return;

    const content = chatMsg.trim();
    setChatMessages((prev) => [
      ...prev,
      { name: myName, text: content, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), self: true },
    ]);

    const socket = socketRef.current;
    if (socket?.connected && joinedRoom) {
      socket.emit('video:chat', { roomId: joinedRoom.id, userId: myId, username: myName, content });
    }

    setChatMsg('');
  };

  const handleChatKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  };

  // ── Create room ───────────────────────────────────────────
  const handleCreate = () => {
    if (!createName.trim()) return;

    const roomId = 'sr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const socket = socketRef.current;

    if (socket?.connected) {
      socket.emit('video:create', { roomId, roomName: createName.trim(), subject: createSubject.trim() || 'General', maxParticipants: createMax });
    }

    const newRoom = {
      id: roomId,
      name: createName.trim(),
      subject: createSubject.trim() || 'General',
      host: myName,
      current: 0,
      max: createMax,
      duration: 'Just now',
      features: ['📹', '🖥️', '📝'],
    };

    setRooms((prev) => [newRoom, ...prev]);
    setShowCreateModal(false);
    setCreateName('');
    setCreateSubject('');
    setCreateMax(8);
  };

  const remoteEntries = Object.entries(remoteStreams);

  return (
    <div className="study-rooms-page">
      <div className="study-rooms-container">
        <header className="sr-header">
          <h1>📚 Study Rooms</h1>
          <p>Focus together, learn better</p>
          <div className="sr-actions">
            <button className="sr-create-btn" onClick={() => setShowCreateModal(true)}>
              ＋ Create Room
            </button>
          </div>
        </header>

        {mediaError && (
          <div className="sr-media-error">
            <span>⚠️</span> {mediaError}
          </div>
        )}

        {joinedRoom ? (
          /* ── Active Room View ──────────────────────────── */
          <div className="sr-active-room">
            <div className="sr-active-header">
              <div>
                <h2 className="sr-active-title">{joinedRoom.name}</h2>
                <p className="sr-active-info">
                  {joinedRoom.subject} · Hosted by {joinedRoom.host || myName}
                </p>
              </div>
              <span className="sr-active-info">{remoteEntries.length + 1} student{remoteEntries.length !== 0 ? 's' : ''}</span>
            </div>

            <div className="sr-active-body">
              <div className="sr-video-grid">
                {/* Local video */}
                <div className="sr-video-tile">
                  {cam ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="sr-video-element"
                    />
                  ) : (
                    <div className="sr-video-initials">
                      {(myName || '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                  )}
                  <span className="sr-video-name">{myName} (You)</span>
                  <span className="sr-video-mic">{mic ? '🎤' : '🔇'}</span>
                  {isScreenSharing && <span className="sr-screen-badge">🖥️ Sharing</span>}
                </div>

                {/* Remote videos */}
                {remoteEntries.map(([socketId, info]) => (
                  <div key={socketId} className="sr-video-tile">
                    {!info.camOff ? (
                      <RemoteVideo stream={info.stream} />
                    ) : (
                      <div className="sr-video-initials">
                        {(info.username || '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                    )}
                    <span className="sr-video-name">{info.username}</span>
                    <span className="sr-video-mic">{info.muted ? '🔇' : '🎤'}</span>
                  </div>
                ))}
              </div>

              {/* Chat Panel */}
              {showChat && (
                <div className="sr-chat-panel">
                  <div className="sr-chat-header">
                    Room Chat
                    <button className="sr-chat-close" onClick={() => setShowChat(false)}>✕</button>
                  </div>
                  <div className="sr-chat-messages">
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={`sr-chat-msg${msg.self ? ' self' : ''}`}>
                        <span className="sr-chat-msg-name">{msg.name}</span>
                        <span className="sr-chat-msg-text">{msg.text}</span>
                        <span className="sr-chat-msg-time">{msg.time}</span>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="sr-chat-input">
                    <input
                      type="text"
                      placeholder="Type a message..."
                      value={chatMsg}
                      onChange={(e) => setChatMsg(e.target.value)}
                      onKeyDown={handleChatKey}
                    />
                    <button className="sr-chat-send" onClick={sendChat}>Send</button>
                  </div>
                </div>
              )}
            </div>

            <div className="sr-active-controls">
              <button className={`sr-ctrl-btn ${cam ? 'active' : ''}`} onClick={toggleCamera}>
                📹 {cam ? 'Cam On' : 'Cam Off'}
              </button>
              <button className={`sr-ctrl-btn ${mic ? 'active' : ''}`} onClick={toggleMic}>
                🎤 {mic ? 'Mic On' : 'Mic Off'}
              </button>
              <button className={`sr-ctrl-btn ${isScreenSharing ? 'active' : ''}`} onClick={toggleScreenShare}>
                🖥️ {isScreenSharing ? 'Stop Share' : 'Share Screen'}
              </button>
              {!showChat && (
                <button className="sr-ctrl-btn" onClick={() => setShowChat(true)}>
                  💬 Chat
                </button>
              )}
              <button className="sr-ctrl-btn leave" onClick={handleLeave}>
                Leave Room
              </button>
            </div>
          </div>
        ) : (
          /* ── Room Grid ────────────────────────────────── */
          <div className="sr-grid">
            {rooms.map((room) => {
              const isFull = room.current >= room.max;
              const fillPercent = (room.current / room.max) * 100;
              return (
                <div key={room.id} className="sr-room-card">
                  <div className="sr-room-top">
                    <span className="sr-room-name">{room.name}</span>
                    <span className="sr-subject-badge">{room.subject}</span>
                  </div>
                  <p className="sr-host">
                    Hosted by <strong>{room.host}</strong>
                  </p>

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
                    {(room.features || []).map((f) => (
                      <span key={f} className="sr-feature-icon">{f} {FEATURE_LABELS[f]}</span>
                    ))}
                  </div>

                  <div className="sr-room-bottom">
                    <span className="sr-duration">{room.duration} active</span>
                    <button
                      className="sr-join-btn"
                      disabled={isFull}
                      onClick={() => !isFull && handleJoin(room)}
                    >
                      {isFull ? 'Full' : 'Join'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Create Room Modal ──────────────────────────── */}
        {showCreateModal && (
          <div className="vr-modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="vr-modal" onClick={(e) => e.stopPropagation()}>
              <h2>Create a Study Room</h2>
              <div className="vr-modal-field">
                <label>Room Name</label>
                <input
                  type="text"
                  placeholder="Enter room name..."
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                />
              </div>
              <div className="vr-modal-field">
                <label>Subject</label>
                <input
                  type="text"
                  placeholder="e.g. Computer Science, Physics..."
                  value={createSubject}
                  onChange={(e) => setCreateSubject(e.target.value)}
                />
              </div>
              <div className="vr-modal-field">
                <label>Max Participants</label>
                <input
                  type="number"
                  min="2"
                  max="20"
                  value={createMax}
                  onChange={(e) => setCreateMax(Number(e.target.value) || 8)}
                />
              </div>
              <div className="vr-modal-actions">
                <button className="vr-modal-cancel" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button className="vr-modal-submit" onClick={handleCreate}>Create Room</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Remote Video Component ──────────────────────────────────
function RemoteVideo({ stream }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className="sr-video-element"
    />
  );
}
