export function setupChatSocket(io, socket, onlineUsers) {
  // Join a conversation room
  socket.on('chat:join', (conversationId) => {
    socket.join(`chat:${conversationId}`);
  });

  // Send a message in real-time
  socket.on('chat:message', (data) => {
    // data: { senderId, receiverId, content, conversationId }
    // Emit to the conversation room
    io.to(`chat:${data.conversationId}`).emit('chat:message', {
      id: Date.now().toString(),
      senderId: data.senderId,
      receiverId: data.receiverId,
      content: data.content,
      createdAt: new Date().toISOString()
    });

    // Also send notification to receiver if they're online but not in chat
    const receiverSocket = onlineUsers.get(data.receiverId);
    if (receiverSocket) {
      io.to(receiverSocket).emit('chat:notification', {
        senderId: data.senderId,
        content: data.content
      });
    }
  });

  // Typing indicator
  socket.on('chat:typing', (data) => {
    // data: { conversationId, userId, isTyping }
    socket.to(`chat:${data.conversationId}`).emit('chat:typing', {
      userId: data.userId,
      isTyping: data.isTyping
    });
  });

  // Leave conversation
  socket.on('chat:leave', (conversationId) => {
    socket.leave(`chat:${conversationId}`);
  });
}
