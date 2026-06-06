import { useState, useMemo } from 'react'
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

function getPasswordStrength(password) {
  if (!password) return { score: 0, label: '' }

  let score = 0
  if (password.length >= 6) score++
  if (password.length >= 10) score++
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++
  if (/\d/.test(password) && /[a-zA-Z]/.test(password)) score++

  const labels = ['', 'Weak', 'Medium', 'Strong', 'Very strong']
  const classes = ['', 'weak', 'medium', 'strong', 'active']

  return {
    score,
    label: labels[score] || '',
    className: classes[score] || '',
  }
}

function SignupPage() {
  const navigate = useNavigate()
  const { collegeSlug } = useParams()
  const { signup } = useAuth()
  const collegeName = collegeNames[collegeSlug] || collegeSlug?.toUpperCase() || 'College'
  const collegeShort = collegeName.split(' ')[0]

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)

  const strength = useMemo(() => getPasswordStrength(password), [password])

  const handleSubmit = (e) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      alert('Passwords do not match.')
      return
    }

    if (!agreeTerms) {
      alert('Please agree to the Terms of Service.')
      return
    }

    signup({
      fullName,
      email,
      username,
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
          <h1>Join TownHall {collegeShort}</h1>
          <p>Create your account and join the community</p>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="auth-right">
        {/* Mobile brand section */}
        <div className="auth-mobile-brand">
          <div className="auth-left-logo">
            <span>TH</span>
          </div>
          <h1>Join TownHall {collegeShort}</h1>
        </div>

        <div className="auth-form-container">
          <form className="auth-form" onSubmit={handleSubmit}>
            <h2>Create Account</h2>
            <p>Fill in your details to get started</p>

            {/* Full Name */}
            <div className="form-group">
              <label htmlFor="signup-name">Full Name</label>
              <input
                id="signup-name"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>

            {/* Email */}
            <div className="form-group">
              <label htmlFor="signup-email">Email</label>
              <input
                id="signup-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            {/* Username with @ prefix */}
            <div className="form-group">
              <label htmlFor="signup-username">Username</label>
              <div className="input-wrapper" style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  fontWeight: 500,
                  fontSize: '0.95rem',
                  pointerEvents: 'none'
                }}>@</span>
                <input
                  id="signup-username"
                  type="text"
                  placeholder="johndoe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  style={{ paddingLeft: '36px' }}
                />
              </div>
            </div>

            {/* Password with strength bar */}
            <div className="form-group">
              <label htmlFor="signup-password">Password</label>
              <input
                id="signup-password"
                type="password"
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              {password && (
                <div className="password-strength">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`password-strength-segment${
                        level <= strength.score ? ` active ${strength.className}` : ''
                      }`}
                    />
                  ))}
                </div>
              )}
              {password && (
                <span className="password-strength-label">{strength.label}</span>
              )}
            </div>

            {/* Confirm Password */}
            <div className="form-group">
              <label htmlFor="signup-confirm">Confirm Password</label>
              <input
                id="signup-confirm"
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            {/* Terms */}
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
              />
              <span>
                I agree to the{' '}
                <a href="#terms" onClick={(e) => e.preventDefault()}>Terms of Service</a>
                {' '}and{' '}
                <a href="#privacy" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
              </span>
            </label>

            <button type="submit" className="auth-submit-btn">
              Create Account
            </button>

            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '24px' }}>
              Already have an account?{' '}
              <Link to={`/${collegeSlug}/login`} className="auth-link">Login</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

export default SignupPage
