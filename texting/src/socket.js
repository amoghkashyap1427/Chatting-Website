// socket.js – Singleton socket connection shared across pages
import { io } from 'socket.io-client'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'https://anonchat-server-je7v.onrender.com'

let socket = null

export function getSocket() {
  if (!socket || socket.disconnected) {
    socket = io(SERVER_URL, { 
      autoConnect: true,
      transports: ['websocket', 'polling']
    })
  }
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
