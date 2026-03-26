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
  const [replyingTo, setReplyingTo] = useState(null)

  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const inputRef = useRef(null)

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

    const onReceiveMessage = ({ senderId, message, timestamp, replyTo }) => {
      setMessages(prev => [...prev, {
        id: Date.now() + Math.random(),
        type: 'message',
        text: message,
        mine: senderId === s.id,
        timestamp,
        replyTo,
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
    s.emit('send_message', { code: roomId, message: text, timestamp: Date.now(), replyTo: replyingTo })
    setInputValue('')
    setReplyingTo(null)
    s.emit('typing', { code: roomId, isTyping: false })
    clearTimeout(typingTimeoutRef.current)
    // Keep focus on input so the mobile keyboard never closes
    inputRef.current?.focus()
  }, [inputValue, roomId, replyingTo])

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

  const scrollToMessage = (msgId) => {
    const el = document.getElementById(`msg-${msgId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('highlight-msg')
      setTimeout(() => el.classList.remove('highlight-msg'), 1500)
    }
  }

  const swipeDeltaRef = useRef(0)
  const swipeStartRef = useRef(0)

  const handleTouchStart = (e, msgId) => {
    swipeStartRef.current = e.touches[0].clientX
    swipeDeltaRef.current = 0
    const el = document.getElementById(`msg-${msgId}`)
    if (el) {
      el.style.transition = 'none'
    }
  }

  const handleTouchMove = (e, msgId) => {
    const delta = e.touches[0].clientX - swipeStartRef.current
    if (delta > 0 && delta < 80) { // Only swipe right up to 80px
      swipeDeltaRef.current = delta
      const el = document.getElementById(`msg-${msgId}`)
      if (el) {
        el.style.transform = `translateX(${delta}px)`
      }
    }
  }

  const handleTouchEnd = (e, msg) => {
    const el = document.getElementById(`msg-${msg.id}`)
    if (el) {
      el.style.transition = 'transform 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28)'
      el.style.transform = ''
      if (swipeDeltaRef.current > 50) {
        setReplyingTo(msg)
      }
    }
    swipeStartRef.current = 0
    swipeDeltaRef.current = 0
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
            <div 
              key={msg.id} 
              id={`msg-${msg.id}`}
              className={`msg-wrapper ${msg.mine ? 'mine' : 'theirs'}`}
              onTouchStart={(e) => handleTouchStart(e, msg.id)}
              onTouchMove={(e) => handleTouchMove(e, msg.id)}
              onTouchEnd={(e) => handleTouchEnd(e, msg)}
            >
              <div className={`bubble ${msg.mine ? 'bubble-mine' : 'bubble-theirs'}`}>
                {msg.replyTo && (
                  <div className={`reply-quote ${msg.replyTo.mine ? 'quote-mine' : 'quote-theirs'}`} onClick={() => scrollToMessage(msg.replyTo.id)}>
                    <div className="reply-quote-sender">{msg.replyTo.mine === msg.mine ? 'You' : 'Stranger'}</div>
                    <div className="reply-quote-text">{msg.replyTo.text}</div>
                  </div>
                )}
                <span className="bubble-text">{msg.text}</span>
                <span className="bubble-time">{formatTime(msg.timestamp)}</span>
              </div>
              <button 
                className="reply-action-btn" 
                title="Reply"
                onClick={() => setReplyingTo(msg)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 17 4 12 9 7"></polyline>
                  <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
                </svg>
              </button>
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
        {replyingTo && (
          <div className="reply-preview-bar">
            <div className="reply-preview-content">
              <span className="reply-preview-title">Replying to {replyingTo.mine ? 'yourself' : 'stranger'}</span>
              <p className="reply-preview-text">{replyingTo.text}</p>
            </div>
            <button className="reply-preview-close" onClick={() => setReplyingTo(null)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        )}
        <div className="input-bar">
          <textarea
            ref={inputRef}
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
            onMouseDown={(e) => e.preventDefault()} // prevent textarea from losing focus
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
