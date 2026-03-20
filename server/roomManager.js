// roomManager.js – In-memory room store

const rooms = {};

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateUniqueCode() {
  let code;
  do {
    code = generateCode();
  } while (rooms[code]);
  return code;
}

function createRoom(code) {
  rooms[code] = { users: [], createdAt: Date.now() };
  return rooms[code];
}

function getRoom(code) {
  return rooms[code] || null;
}

function deleteRoom(code) {
  delete rooms[code];
}

function addUser(code, socketId) {
  if (rooms[code]) {
    rooms[code].users.push(socketId);
  }
}

function removeUser(code, socketId) {
  if (rooms[code]) {
    rooms[code].users = rooms[code].users.filter(id => id !== socketId);
  }
}

function isFull(code) {
  return rooms[code] && rooms[code].users.length >= 2;
}

function getRoomByUser(socketId) {
  for (const [code, room] of Object.entries(rooms)) {
    if (room.users.includes(socketId)) {
      return { code, room };
    }
  }
  return null;
}

module.exports = {
  generateUniqueCode,
  createRoom,
  getRoom,
  deleteRoom,
  addUser,
  removeUser,
  isFull,
  getRoomByUser,
};
