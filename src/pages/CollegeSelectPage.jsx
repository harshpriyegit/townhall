import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CollegeCard from '../components/CollegeCard'
import '../styles/college-select.css'

const colleges = [
  { id: 1, name: 'VIT Vellore', slug: 'vit', location: 'Vellore, Tamil Nadu', initials: 'VIT', active: true },
  { id: 2, name: 'IIT Delhi', slug: 'iitd', location: 'New Delhi', initials: 'IIT', active: false },
  { id: 3, name: 'BITS Pilani', slug: 'bits', location: 'Pilani, Rajasthan', initials: 'BITS', active: false },
  { id: 4, name: 'NIT Trichy', slug: 'nitt', location: 'Trichy, Tamil Nadu', initials: 'NIT', active: false },
  { id: 5, name: 'DTU Delhi', slug: 'dtu', location: 'New Delhi', initials: 'DTU', active: false },
  { id: 6, name: 'IIIT Hyderabad', slug: 'iiith', location: 'Hyderabad, Telangana', initials: 'IIIT', active: false },
]

function CollegeSelectPage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')

  const filteredColleges = colleges.filter((college) => {
    const query = searchQuery.toLowerCase()
    return (
      college.name.toLowerCase().includes(query) ||
      college.location.toLowerCase().includes(query) ||
      college.initials.toLowerCase().includes(query)
    )
  })

  return (
    <div className="college-page">
      <button className="college-back" onClick={() => navigate('/')}>
        <span>←</span>
        Back
      </button>

      <header className="college-header">
        <h1>Choose Your TownHall</h1>
        <p>Select your college to join the community</p>
      </header>

      <div className="college-search">
        <span className="college-search-icon" aria-hidden="true">🔍</span>
        <input
          type="text"
          placeholder="Search colleges..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search colleges"
        />
      </div>

      <div className="college-grid">
        {filteredColleges.length > 0 ? (
          filteredColleges.map((college, index) => (
            <CollegeCard
              key={college.id}
              name={college.name}
              initials={college.initials}
              location={college.location}
              active={college.active}
              comingSoon={!college.active}
              onClick={() => navigate(`/${college.slug}/login`)}
              delay={index * 80}
            />
          ))
        ) : (
          <div className="college-no-results">
            <p>No colleges match your search.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default CollegeSelectPage
