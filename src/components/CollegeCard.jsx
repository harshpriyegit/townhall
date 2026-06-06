function CollegeCard({ name, initials, location, active, comingSoon, onClick, delay }) {
  return (
    <div
      className={`college-card${active ? ' active' : ''}${comingSoon ? ' coming-soon' : ''}`}
      onClick={active ? onClick : undefined}
      style={{ animationDelay: `${delay}ms` }}
      role={active ? 'button' : undefined}
      tabIndex={active ? 0 : undefined}
      onKeyDown={active ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
      aria-label={active ? `Select ${name}` : `${name} — coming soon`}
    >
      <div className="college-card-logo">
        <span>{initials}</span>
      </div>

      <h3 className="college-card-name">{name}</h3>

      <p className="college-card-location">{location}</p>

      {comingSoon && (
        <span className="coming-soon-badge">Coming Soon</span>
      )}
    </div>
  )
}

export default CollegeCard
