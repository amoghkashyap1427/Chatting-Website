import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { getSocket, disconnectSocket } from '../socket'
import './Chat.css'

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function Chat() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isCreator = location.state?.isCreator ?? false

  const [connected, setConnected] = useState(false)
  const [strangerOnline, setStrangerOnline] = useState(false)
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false) // stranger typing
  const [mySocketId, setMySocketId] = useState(null)
  const [statusMsg, setStatusMsg] = useState('')

  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const addSystemMsg = useCallback((text) => {
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), type: 'system', text }])
  }, [])

  useEffect(() => {
    const s = getSocket()

    const onConnect = () => {
      setConnected(true)
      setMySocketId(s.id)
      // If creator: room already created in Home and socket already in room, just wait
      // If joiner: room already joined in Home, just set up listeners
      if (isCreator) {
        addSystemMsg('Room created. Waiting for stranger to join…')
      }
    }

    const onDisconnect = () => setConnected(false)

    const onUserConnected = () => {
      setStrangerOnline(true)
      addSystemMsg('Stranger connected.')
    }

    const onUserDisconnected = ({ message }) => {
      setStrangerOnline(false)
      addSystemMsg(message || 'Stranger left the chat.')
    }

    const onReceiveMessage = ({ senderId, message, timestamp }) => {
      setMessages(prev => [...prev, {
        id: Date.now() + Math.random(),
        type: 'message',
        text: message,
        mine: senderId === s.id,
        timestamp,
      }])
    }

    const onStrangerTyping = ({ isTyping: val }) => setIsTyping(val)

    // Register listeners
    if (s.connected) {
      setConnected(true)
      setMySocketId(s.id)
      if (isCreator) addSystemMsg('Room created. Waiting for stranger to join…')
      else setStrangerOnline(true) // joiner joined in Home already, assume stranger (creator) is there
    }

    s.on('connect', onConnect)
    s.on('disconnect', onDisconnect)
    s.on('user_connected', onUserConnected)
    s.on('user_disconnected', onUserDisconnected)
    s.on('receive_message', onReceiveMessage)
    s.on('stranger_typing', onStrangerTyping)

    return () => {
      s.off('connect', onConnect)
      s.off('disconnect', onDisconnect)
      s.off('user_connected', onUserConnected)
      s.off('user_disconnected', onUserDisconnected)
      s.off('receive_message', onReceiveMessage)
      s.off('stranger_typing', onStrangerTyping)
      clearTimeout(typingTimeoutRef.current)
    }
  }, [roomId, isCreator, addSystemMsg])

  // Page unload
  useEffect(() => {
    const handler = () => disconnectSocket()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  const handleSend = useCallback(() => {
    const text = inputValue.trim()
    if (!text) return
    const s = getSocket()
    s.emit('send_message', { code: roomId, message: text, timestamp: Date.now() })
    setInputValue('')
    s.emit('typing', { code: roomId, isTyping: false })
    clearTimeout(typingTimeoutRef.current)
  }, [inputValue, roomId])

  const handleInputChange = (e) => {
    setInputValue(e.target.value)
    const s = getSocket()
    s.emit('typing', { code: roomId, isTyping: true })
    clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      s.emit('typing', { code: roomId, isTyping: false })
    }, 1500)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleLeave = () => {
    disconnectSocket()
    navigate('/')
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomId)
  }

  return (
    <div className="chat-layout">
      {/* Header */}
      <header className="chat-header">
        <div className="chat-header-left">
          <div className="avatar-circle">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div className="chat-header-info">
            <h1 className="chat-title">Anonymous Chat</h1>
            <div className="chat-meta">
              <button className="room-code-btn" onClick={handleCopyCode} title="Copy room code">
                {roomId}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
              </button>
              <span className={`status-dot ${connected ? (strangerOnline ? 'online' : 'waiting') : 'offline'}`} />
              <span className="status-text">
                {!connected ? 'Disconnected' : strangerOnline ? 'Connected' : 'Waiting…'}
              </span>
            </div>
          </div>
        </div>
        <button className="leave-btn" onClick={handleLeave}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
          </svg>
          Leave
        </button>
      </header>

      {/* Messages */}
      <main className="chat-messages" id="chat-messages">
        {statusMsg && (
          <div className="status-banner">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            {statusMsg}
          </div>
        )}

        {messages.length === 0 && !statusMsg && (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <p>No messages yet.</p>
            <p className="empty-sub">Share the room code <strong>{roomId}</strong> to start chatting.</p>
          </div>
        )}

        {messages.map((msg) => {
          if (msg.type === 'system') {
            return (
              <div key={msg.id} className="system-msg">
                <span>{msg.text}</span>
              </div>
            )
          }
          return (
            <div key={msg.id} className={`msg-wrapper ${msg.mine ? 'mine' : 'theirs'}`}>
              <div className={`bubble ${msg.mine ? 'bubble-mine' : 'bubble-theirs'}`}>
                <span className="bubble-text">{msg.text}</span>
                <span className="bubble-time">{formatTime(msg.timestamp)}</span>
              </div>
            </div>
          )
        })}

        {/* Typing indicator */}
        {isTyping && (
          <div className="msg-wrapper theirs">
            <div className="bubble bubble-theirs typing-bubble">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Input bar */}
      <footer className="chat-footer">
        <div className="input-bar">
          <textarea
            className="msg-input"
            placeholder={strangerOnline ? 'Type a message…' : 'Waiting for stranger…'}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={!strangerOnline}
          />
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={!strangerOnline || !inputValue.trim()}
            title="Send"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/>
            </svg>
          </button>
        </div>
        <p className="footer-note">Anonymous · Ephemeral · No messages stored</p>
      </footer>
    </div>
  )
}
