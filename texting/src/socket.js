// socket.js – Singleton socket connection shared across pages
import { io } from 'socket.io-client'

const SERVER_URL = import.meta.env.DEV ? 'http://localhost:3001' : 'https://anonchat-server-je7v.onrender.com'

let socket = null

export function getSocket() {
  if (!socket || socket.disconnected) {
    socket = io(SERVER_URL, { autoConnect: true })
  }
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
