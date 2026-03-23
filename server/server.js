// server.js – Entry point: Express + Socket.io server

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const setupSocketHandlers = require('./socketHandler');

const PORT = process.env.PORT || 3001;

const app = express();
const httpServer = http.createServer(app);

// Configure CORS for Socket.io (allow Vite dev server)
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:5173", "https://chatting-website-27.vercel.app"],
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// Health-check endpoint
app.get('/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Mount all socket event handlers
setupSocketHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`✅  Chat server running on http://localhost:${PORT}`);
});
