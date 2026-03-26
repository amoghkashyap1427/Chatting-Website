// socketHandler.js – All socket event handlers

const {
  generateUniqueCode,
  createRoom,
  getRoom,
  deleteRoom,
  addUser,
  removeUser,
  isFull,
  getRoomByUser,
} = require('./roomManager');

module.exports = function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[+] Socket connected: ${socket.id}`);

    // Create a new room
    socket.on('create_room', (_, callback) => {
      const code = generateUniqueCode();
      createRoom(code);
      addUser(code, socket.id);
      socket.join(code);
      console.log(`[Room] Created: ${code} by ${socket.id}`);
      if (typeof callback === 'function') callback({ success: true, code });
    });

    // Join an existing room
    socket.on('join_room', ({ code }, callback) => {
      const room = getRoom(code);
      if (!room) {
        if (typeof callback === 'function') callback({ success: false, error: 'Room not found.' });
        return;
      }
      if (isFull(code)) {
        if (typeof callback === 'function') callback({ success: false, error: 'Room is full (max 2 users).' });
        return;
      }

      addUser(code, socket.id);
      socket.join(code);
      console.log(`[Room] ${socket.id} joined: ${code}`);

      // Notify the OTHER user already in the room
      socket.to(code).emit('user_connected', { message: 'Stranger connected.' });

      if (typeof callback === 'function') callback({ success: true, code });
    });

    // Send a message to the room
    socket.on('send_message', ({ code, message, timestamp, replyTo }) => {
      const room = getRoom(code);
      if (!room) return;
      // Broadcast to ALL in room (sender gets it back via 'receive_message')
      io.to(code).emit('receive_message', {
        senderId: socket.id,
        message,
        timestamp,
        replyTo,
      });
      console.log(`[Msg] Room ${code}: ${message.substring(0, 40)}`);
    });

    // Typing indicator
    socket.on('typing', ({ code, isTyping }) => {
      socket.to(code).emit('stranger_typing', { isTyping });
    });

    // Disconnect handling
    socket.on('disconnect', () => {
      console.log(`[-] Socket disconnected: ${socket.id}`);
      const result = getRoomByUser(socket.id);
      if (!result) return;

      const { code } = result;
      removeUser(code, socket.id);

      const room = getRoom(code);
      if (room && room.users.length === 0) {
        deleteRoom(code);
        console.log(`[Room] Deleted empty room: ${code}`);
      } else {
        // Notify remaining user
        socket.to(code).emit('user_disconnected', { message: 'Stranger left the chat.' });
        console.log(`[Room] User left ${code}, ${room ? room.users.length : 0} remaining`);
      }
    });
  });
};
