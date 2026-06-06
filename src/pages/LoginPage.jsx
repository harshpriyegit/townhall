import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../styles/auth.css'

const collegeNames = {
  vit: 'VIT Vellore',
  iitd: 'IIT Delhi',
  bits: 'BITS Pilani',
  nitt: 'NIT Trichy',
  dtu: 'DTU Delhi',
  iiith: 'IIIT Hyderabad',
}

function LoginPage() {
  const navigate = useNavigate()
  const { collegeSlug } = useParams()
  const { login } = useAuth()
  const collegeName = collegeNames[collegeSlug] || collegeSlug?.toUpperCase() || 'College'
  const collegeShort = collegeName.split(' ')[0]

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    login({
      email,
      username: email.split('@')[0],
      fullName: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      college: collegeSlug || 'vit',
    })
    navigate('/app')
  }

  return (
    <div className="auth-page">
      {/* Left Panel — Branding */}
      <div className="auth-left">
        <Link to="/colleges" className="auth-back-link">
          <span>←</span>
          Back to colleges
        </Link>

        <div className="auth-left-content">
          <div className="auth-left-logo">
            <span>TH</span>
          </div>
          <h1>TownHall {collegeShort}</h1>
          <p>Welcome back to your community</p>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="auth-right">
        {/* Mobile brand section */}
        <div className="auth-mobile-brand">
          <div className="auth-left-logo">
            <span>TH</span>
          </div>
          <h1>TownHall {collegeShort}</h1>
        </div>

        <div className="auth-form-container">
          <form className="auth-form" onSubmit={handleSubmit}>
            <h2>Login</h2>
            <p>Enter your credentials to continue</p>

            <div className="form-group">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <div className="form-row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <label className="form-checkbox" style={{ marginBottom: 0 }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>
              <button type="button" className="auth-link" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>
                Forgot password?
              </button>
            </div>

            <button type="submit" className="auth-submit-btn">
              Login
            </button>

            <div className="auth-divider">
              <span>or</span>
            </div>

            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              Don't have an account?{' '}
              <Link to={`/${collegeSlug}/signup`} className="auth-link">Sign up</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
