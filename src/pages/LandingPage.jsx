import { useNavigate } from 'react-router-dom'
import '../styles/landing.css'

function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="landing-page">
      {/* Floating geometric decorations */}
      <div className="landing-floating-shape" />
      <div className="landing-floating-shape" />
      <div className="landing-floating-shape" />
      <div className="landing-floating-shape" />
      <div className="landing-floating-shape" />
      <div className="landing-floating-shape" />

      {/* Main content */}
      <div className="landing-container">
        <div className="landing-logo">
          <span className="landing-logo-text">TH</span>
        </div>

        <h1 className="landing-title">TownHall</h1>

        <p className="landing-tagline">
          Your College. Your Community. Your Space.
        </p>

        <button
          className="landing-enter-btn"
          onClick={() => navigate('/colleges')}
          aria-label="Enter TownHall"
        >
          Enter TownHall
          <span className="btn-arrow">→</span>
        </button>
      </div>

      {/* Footer */}
      <div className="landing-version">
        © 2026 TownHall
      </div>
    </div>
  )
}

export default LandingPage
