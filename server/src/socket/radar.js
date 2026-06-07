// Haversine formula — distance between two lat/lng points in meters
function toRad(deg) {
  return deg * (Math.PI / 180);
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Check for nearby users and send proximity alerts to both parties
function checkNearbyUsers(io, userId, radarUsers) {
  const currentUser = radarUsers.get(userId);
  if (!currentUser) return;

  for (const [otherId, otherUser] of radarUsers.entries()) {
    if (otherId === userId) continue;

    const distance = haversineDistance(
      currentUser.latitude,
      currentUser.longitude,
      otherUser.latitude,
      otherUser.longitude
    );

    // If within either user's range, notify both
    if (distance <= currentUser.range || distance <= otherUser.range) {
      io.to(currentUser.socketId).emit('radar:proximity-alert', {
        userId: otherId,
        username: otherUser.username,
        distance: Math.round(distance),
      });

      io.to(otherUser.socketId).emit('radar:proximity-alert', {
        userId,
        username: currentUser.username,
        distance: Math.round(distance),
      });
    }
  }
}

/**
 * Proximity Radar socket handler.
 * Tracks radar-enabled users and emits real-time proximity alerts.
 *
 * Global store: Map<userId, { socketId, username, latitude, longitude, range, followersOnly, lastUpdate }>
 */
export function setupRadarSocket(io, socket, onlineUsers) {
  if (!global.radarUsers) global.radarUsers = new Map();
  const radarUsers = global.radarUsers;

  // ── Enable radar — user starts sharing location ────────────────────
  socket.on('radar:enable', (data) => {
    // data: { userId, username, latitude, longitude, range?, followersOnly? }
    radarUsers.set(data.userId, {
      socketId: socket.id,
      username: data.username,
      latitude: data.latitude,
      longitude: data.longitude,
      range: data.range || 100, // metres
      followersOnly: data.followersOnly || false,
      lastUpdate: new Date().toISOString(),
    });

    checkNearbyUsers(io, data.userId, radarUsers);
  });

  // ── Update location ────────────────────────────────────────────────
  socket.on('radar:update-location', (data) => {
    // data: { userId, latitude, longitude }
    const user = radarUsers.get(data.userId);
    if (user) {
      user.latitude = data.latitude;
      user.longitude = data.longitude;
      user.lastUpdate = new Date().toISOString();

      checkNearbyUsers(io, data.userId, radarUsers);
    }
  });

  // ── Update radar settings ──────────────────────────────────────────
  socket.on('radar:update-settings', (data) => {
    // data: { userId, range?, followersOnly? }
    const user = radarUsers.get(data.userId);
    if (user) {
      if (data.range !== undefined) user.range = data.range;
      if (data.followersOnly !== undefined) user.followersOnly = data.followersOnly;
    }
  });

  // ── Disable radar ──────────────────────────────────────────────────
  socket.on('radar:disable', (data) => {
    // data: { userId }
    radarUsers.delete(data.userId);
    io.emit('radar:user-offline', { userId: data.userId });
  });

  // ── Get nearby users on demand ─────────────────────────────────────
  socket.on('radar:get-nearby', (data) => {
    // data: { userId }
    const currentUser = radarUsers.get(data.userId);
    if (!currentUser) return;

    const nearby = [];
    for (const [otherId, otherUser] of radarUsers.entries()) {
      if (otherId === data.userId) continue;

      const distance = haversineDistance(
        currentUser.latitude,
        currentUser.longitude,
        otherUser.latitude,
        otherUser.longitude
      );

      if (distance <= currentUser.range) {
        nearby.push({
          userId: otherId,
          username: otherUser.username,
          distance: Math.round(distance),
          lastUpdate: otherUser.lastUpdate,
        });
      }
    }

    socket.emit('radar:nearby-users', nearby);
  });

  // ── Wave at a nearby user ──────────────────────────────────────────
  socket.on('radar:wave', (data) => {
    // data: { fromUserId, fromUsername, toUserId }
    const targetUser = radarUsers.get(data.toUserId);
    if (targetUser) {
      io.to(targetUser.socketId).emit('radar:wave-received', {
        fromUserId: data.fromUserId,
        fromUsername: data.fromUsername,
      });
    }
  });

  // ── Cleanup on disconnect ──────────────────────────────────────────
  socket.on('disconnect', () => {
    for (const [userId, user] of radarUsers.entries()) {
      if (user.socketId === socket.id) {
        radarUsers.delete(userId);
        io.emit('radar:user-offline', { userId });
        break;
      }
    }
  });
}
