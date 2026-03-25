import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSocket } from '../socket'
import './Home.css'

export default function Home() {
  const navigate = useNavigate()
  const [generatedCode, setGeneratedCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [serverOnline, setServerOnline] = useState(false)
  const [isServerLoading, setIsServerLoading] = useState(true)

  useEffect(() => {
    const s = getSocket()
    const onConnect = () => { setServerOnline(true); setIsServerLoading(false) }
    const onDisconnect = () => setServerOnline(false)
    const onError = () => { setServerOnline(false); setIsServerLoading(false) }

    if (s.connected) { setServerOnline(true); setIsServerLoading(false) }
    s.on('connect', onConnect)
    s.on('disconnect', onDisconnect)
    s.on('connect_error', onError)

    return () => {
      s.off('connect', onConnect)
      s.off('disconnect', onDisconnect)
      s.off('connect_error', onError)
      // Do NOT disconnect — socket must persist for Chat page
    }
  }, [])

  const handleGenerate = useCallback(() => {
    if (!serverOnline) {
      setError('Cannot connect to server. Make sure the backend is running.')
      return
    }
    setError('')
    setIsGenerating(true)
    const s = getSocket()
    s.emit('create_room', {}, (res) => {
      setIsGenerating(false)
      if (res?.success) {
        setGeneratedCode(res.code)
      } else {
        setError('Failed to create room. Try again.')
      }
    })
  }, [serverOnline])

  const handleEnterChat = useCallback(() => {
    if (!generatedCode) return
    navigate(`/chat/${generatedCode}`, { state: { isCreator: true } })
  }, [generatedCode, navigate])

  const handleJoin = useCallback(() => {
    const code = joinCode.trim().toUpperCase()
    if (!code || code.length !== 6) {
      setError('Please enter a valid 6-character room code.')
      return
    }
    if (!serverOnline) {
      setError('Cannot connect to server. Make sure the backend is running.')
      return
    }
    setError('')
    setIsConnecting(true)
    const s = getSocket()
    s.emit('join_room', { code }, (res) => {
      setIsConnecting(false)
      if (res?.success) {
        navigate(`/chat/${code}`, { state: { isCreator: false } })
      } else {
        setError(res?.error || 'Could not join room.')
      }
    })
  }, [serverOnline, joinCode, navigate])

  const handleCopy = useCallback(() => {
    if (!generatedCode) return
    navigator.clipboard.writeText(generatedCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [generatedCode])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleJoin()
  }

  return (
    <>
    {isServerLoading && (
      <div className="boot-overlay">
        <div className="boot-spinner">
          <div className="ring ring-1" />
          <div className="ring ring-2" />
          <div className="ring ring-3" />
          <div className="boot-dot" />
        </div>
        <p className="boot-label">Connecting to server…</p>
      </div>
    )}
    <div className="home-container">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      <div className="home-card">
        <div className="home-header">
          <div className="logo-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M16 2C8.268 2 2 8.268 2 16c0 2.57.694 4.977 1.906 7.04L2 30l7.293-1.84A13.94 13.94 0 0016 30c7.732 0 14-6.268 14-14S23.732 2 16 2z" fill="url(#g1)"/>
              <defs>
                <linearGradient id="g1" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#7C3AED"/>
                  <stop offset="1" stopColor="#2563EB"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="home-title">Anonymous Chat</h1>
          <p className="home-subtitle">Share the code!! and STARTT</p>
          {!serverOnline && !isServerLoading && (
            <div className="server-warn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
              Backend offline — start the server
            </div>
          )}
        </div>

        <div className="section">
          <h2 className="section-label">Start a new room</h2>
          {!generatedCode ? (
            <button className="btn btn-primary" onClick={handleGenerate} disabled={!serverOnline || isGenerating}>
              {isGenerating ? (
                <>
                  <span className="btn-spinner" />
                  Generating…
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                  Generate Code
                </>
              )}
            </button>
          ) : (
            <div className="code-display">
              <span className="code-text">{generatedCode}</span>
              <button className="btn-icon" onClick={handleCopy} title="Copy code">
                {copied
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                }
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleEnterChat}>
                Enter Chat →
              </button>
            </div>
          )}
          {generatedCode && (
            <p className="hint">Share this code with one person, then click Enter Chat.</p>
          )}
        </div>

        <div className="divider"><span>or</span></div>

        <div className="section">
          <h2 className="section-label">Join an existing room</h2>
          <div className="input-row">
            <input
              className="code-input"
              type="text"
              placeholder="Enter 6-char code"
              value={joinCode}
              maxLength={6}
              onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError('') }}
              onKeyDown={handleKeyDown}
              spellCheck={false}
            />
            <button
              className="btn btn-secondary"
              onClick={handleJoin}
              disabled={isConnecting || !serverOnline}
            >
              {isConnecting ? 'Joining…' : 'Join Chat'}
            </button>
          </div>
        </div>

        {error && (
          <div className="error-msg">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            {error}
          </div>
        )}

        <p className="home-footer">No accounts. No logs. 100% anonymous.</p>
      </div>
    </div>
    </>
  )
}
