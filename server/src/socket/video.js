export function setupVideoSocket(io, socket, onlineUsers) {
  if (!global.videoRooms) global.videoRooms = new Map();
  const videoRooms = global.videoRooms;

  // Create study room
  socket.on('video:create', (data) => {
    // data: { roomId, roomName, subject, maxParticipants, userId }
    videoRooms.set(data.roomId, {
      name: data.roomName,
      subject: data.subject,
      maxParticipants: data.maxParticipants || 8,
      host: data.userId,
      createdAt: new Date().toISOString(),
      participants: new Map(),
      chat: []
    });
    io.emit('video:rooms', getVideoRoomsList());
  });

  // Join study room
  socket.on('video:join', (data) => {
    // data: { roomId, userId, username }
    const room = videoRooms.get(data.roomId);
    if (!room) return;
    if (room.participants.size >= room.maxParticipants) {
      socket.emit('video:error', { message: 'Room is full' });
      return;
    }

    room.participants.set(socket.id, {
      userId: data.userId,
      username: data.username,
      muted: false,
      videoOff: false,
      screenSharing: false
    });

    socket.join(`video:${data.roomId}`);

    io.to(`video:${data.roomId}`).emit('video:participant-joined', {
      socketId: socket.id,
      userId: data.userId,
      username: data.username
    });

    const participants = Array.from(room.participants.entries()).map(([sid, p]) => ({
      socketId: sid,
      ...p
    }));
    socket.emit('video:participants', participants);
    socket.emit('video:chat-history', room.chat);
    io.emit('video:rooms', getVideoRoomsList());
  });

  // WebRTC signaling
  socket.on('video:offer', (data) => {
    // data: { targetSocketId, offer }
    io.to(data.targetSocketId).emit('video:offer', {
      senderSocketId: socket.id,
      offer: data.offer
    });
  });

  socket.on('video:answer', (data) => {
    // data: { targetSocketId, answer }
    io.to(data.targetSocketId).emit('video:answer', {
      senderSocketId: socket.id,
      answer: data.answer
    });
  });

  socket.on('video:ice-candidate', (data) => {
    // data: { targetSocketId, candidate }
    io.to(data.targetSocketId).emit('video:ice-candidate', {
      senderSocketId: socket.id,
      candidate: data.candidate
    });
  });

  // Toggle camera/mic
  socket.on('video:toggle-media', (data) => {
    // data: { roomId, type: 'audio'|'video', enabled }
    const room = videoRooms.get(data.roomId);
    if (room && room.participants.has(socket.id)) {
      const p = room.participants.get(socket.id);
      if (data.type === 'audio') p.muted = !data.enabled;
      if (data.type === 'video') p.videoOff = !data.enabled;
      io.to(`video:${data.roomId}`).emit('video:media-changed', {
        socketId: socket.id,
        type: data.type,
        enabled: data.enabled
      });
    }
  });

  // Screen share
  socket.on('video:screen-share', (data) => {
    // data: { roomId, sharing }
    const room = videoRooms.get(data.roomId);
    if (room && room.participants.has(socket.id)) {
      room.participants.get(socket.id).screenSharing = data.sharing;
      io.to(`video:${data.roomId}`).emit('video:screen-share-changed', {
        socketId: socket.id,
        sharing: data.sharing
      });
    }
  });

  // Room chat
  socket.on('video:chat', (data) => {
    // data: { roomId, userId, username, content }
    const room = videoRooms.get(data.roomId);
    if (room) {
      const msg = {
        userId: data.userId,
        username: data.username,
        content: data.content,
        createdAt: new Date().toISOString()
      };
      room.chat.push(msg);
      io.to(`video:${data.roomId}`).emit('video:chat-message', msg);
    }
  });

  // Leave room
  socket.on('video:leave', (data) => {
    // data: { roomId }
    const room = videoRooms.get(data.roomId);
    if (room) {
      room.participants.delete(socket.id);
      socket.leave(`video:${data.roomId}`);
      io.to(`video:${data.roomId}`).emit('video:participant-left', {
        socketId: socket.id
      });
      if (room.participants.size === 0) {
        videoRooms.delete(data.roomId);
      }
      io.emit('video:rooms', getVideoRoomsList());
    }
  });

  socket.on('video:get-rooms', () => {
    socket.emit('video:rooms', getVideoRoomsList());
  });

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    for (const [roomId, room] of videoRooms.entries()) {
      if (room.participants.has(socket.id)) {
        room.participants.delete(socket.id);
        io.to(`video:${roomId}`).emit('video:participant-left', {
          socketId: socket.id
        });
        if (room.participants.size === 0) {
          videoRooms.delete(roomId);
        }
      }
    }
    io.emit('video:rooms', getVideoRoomsList());
  });

  function getVideoRoomsList() {
    return Array.from(videoRooms.entries()).map(([id, room]) => ({
      id,
      name: room.name,
      subject: room.subject,
      participantCount: room.participants.size,
      maxParticipants: room.maxParticipants,
      host: room.host,
      createdAt: room.createdAt
    }));
  }
}
