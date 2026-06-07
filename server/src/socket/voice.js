export function setupVoiceSocket(io, socket, onlineUsers) {
  // Track voice rooms: Map<roomId, { name, topic, createdAt, participants: Map }>
  if (!global.voiceRooms) global.voiceRooms = new Map();
  const voiceRooms = global.voiceRooms;

  // Create a voice room
  socket.on('voice:create', (data) => {
    // data: { roomId, roomName, topic }
    voiceRooms.set(data.roomId, {
      name: data.roomName,
      topic: data.topic,
      createdAt: new Date().toISOString(),
      participants: new Map()
    });
    io.emit('voice:rooms', getVoiceRoomsList());
  });

  // Join a voice room
  socket.on('voice:join', (data) => {
    // data: { roomId, userId, username }
    const room = voiceRooms.get(data.roomId);
    if (!room) return;

    room.participants.set(socket.id, {
      userId: data.userId,
      username: data.username,
      muted: false,
      handRaised: false
    });

    socket.join(`voice:${data.roomId}`);

    // Notify all in room
    io.to(`voice:${data.roomId}`).emit('voice:participant-joined', {
      socketId: socket.id,
      userId: data.userId,
      username: data.username
    });

    // Send current participants to the joiner
    const participants = Array.from(room.participants.entries()).map(([sid, p]) => ({
      socketId: sid,
      ...p
    }));
    socket.emit('voice:participants', participants);

    // Update room list for everyone
    io.emit('voice:rooms', getVoiceRoomsList());
  });

  // WebRTC signaling - offer
  socket.on('voice:offer', (data) => {
    // data: { targetSocketId, offer }
    io.to(data.targetSocketId).emit('voice:offer', {
      senderSocketId: socket.id,
      offer: data.offer
    });
  });

  // WebRTC signaling - answer
  socket.on('voice:answer', (data) => {
    // data: { targetSocketId, answer }
    io.to(data.targetSocketId).emit('voice:answer', {
      senderSocketId: socket.id,
      answer: data.answer
    });
  });

  // WebRTC signaling - ICE candidate
  socket.on('voice:ice-candidate', (data) => {
    // data: { targetSocketId, candidate }
    io.to(data.targetSocketId).emit('voice:ice-candidate', {
      senderSocketId: socket.id,
      candidate: data.candidate
    });
  });

  // Toggle mute
  socket.on('voice:toggle-mute', (data) => {
    // data: { roomId, muted }
    const room = voiceRooms.get(data.roomId);
    if (room && room.participants.has(socket.id)) {
      room.participants.get(socket.id).muted = data.muted;
      io.to(`voice:${data.roomId}`).emit('voice:mute-changed', {
        socketId: socket.id,
        muted: data.muted
      });
    }
  });

  // Raise/lower hand
  socket.on('voice:toggle-hand', (data) => {
    // data: { roomId }
    const room = voiceRooms.get(data.roomId);
    if (room && room.participants.has(socket.id)) {
      const p = room.participants.get(socket.id);
      p.handRaised = !p.handRaised;
      io.to(`voice:${data.roomId}`).emit('voice:hand-changed', {
        socketId: socket.id,
        handRaised: p.handRaised
      });
    }
  });

  // Leave voice room
  socket.on('voice:leave', (data) => {
    // data: { roomId }
    const room = voiceRooms.get(data.roomId);
    if (room) {
      room.participants.delete(socket.id);
      socket.leave(`voice:${data.roomId}`);

      io.to(`voice:${data.roomId}`).emit('voice:participant-left', {
        socketId: socket.id
      });

      // Delete empty rooms
      if (room.participants.size === 0) {
        voiceRooms.delete(data.roomId);
      }

      io.emit('voice:rooms', getVoiceRoomsList());
    }
  });

  // Get rooms list
  socket.on('voice:get-rooms', () => {
    socket.emit('voice:rooms', getVoiceRoomsList());
  });

  // Handle disconnect - clean up from all voice rooms
  socket.on('disconnect', () => {
    for (const [roomId, room] of voiceRooms.entries()) {
      if (room.participants.has(socket.id)) {
        room.participants.delete(socket.id);
        io.to(`voice:${roomId}`).emit('voice:participant-left', {
          socketId: socket.id
        });
        if (room.participants.size === 0) {
          voiceRooms.delete(roomId);
        }
      }
    }
    io.emit('voice:rooms', getVoiceRoomsList());
  });

  function getVoiceRoomsList() {
    return Array.from(voiceRooms.entries()).map(([id, room]) => ({
      id,
      name: room.name,
      topic: room.topic,
      participantCount: room.participants.size,
      createdAt: room.createdAt
    }));
  }
}
