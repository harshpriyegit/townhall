import { useState } from 'react';
import '../styles/cuffing.css';

const EVENTS = [
  { id: 1, name: 'Riviera 2026', date: 'Feb 14-17, 2026', time: '6:00 PM', venue: 'Main Campus', going: 234, banner: 'b1' },
  { id: 2, name: 'Freshers Night', date: 'Aug 20, 2026', time: '7:30 PM', venue: 'Auditorium', going: 89, banner: 'b2' },
  { id: 3, name: 'Cultural Fest', date: 'Oct 5-7, 2026', time: '5:00 PM', venue: 'Open Air Theatre', going: 156, banner: 'b3' },
  { id: 4, name: 'New Year Bash', date: 'Dec 31, 2026', time: '9:00 PM', venue: 'Central Grounds', going: 312, banner: 'b4' },
];

const PARTICIPANTS = [
  { id: 1, name: 'Aarav Singh', branch: 'CSE', year: '2nd', initials: 'AS', available: true },
  { id: 2, name: 'Diya Sharma', branch: 'ECE', year: '3rd', initials: 'DS', available: true },
  { id: 3, name: 'Vikram Raj', branch: 'MECH', year: '2nd', initials: 'VR', available: false },
  { id: 4, name: 'Neha Gupta', branch: 'IT', year: '1st', initials: 'NG', available: true },
  { id: 5, name: 'Rohan Das', branch: 'CSE', year: '4th', initials: 'RD', available: true },
  { id: 6, name: 'Kavya Patel', branch: 'BioTech', year: '2nd', initials: 'KP', available: false },
  { id: 7, name: 'Arjun Nair', branch: 'ECE', year: '3rd', initials: 'AN', available: true },
  { id: 8, name: 'Meera Iyer', branch: 'IT', year: '1st', initials: 'MI', available: true },
];

const SENT_REQUESTS = [
  { name: 'Aarav Singh', initials: 'AS', event: 'Riviera 2026', status: 'pending' },
  { name: 'Neha Gupta', initials: 'NG', event: 'Freshers Night', status: 'accepted' },
  { name: 'Kavya Patel', initials: 'KP', event: 'Cultural Fest', status: 'declined' },
];

const RECEIVED_REQUESTS = [
  { name: 'Diya Sharma', initials: 'DS', event: 'Riviera 2026' },
  { name: 'Rohan Das', initials: 'RD', event: 'New Year Bash' },
];

const BRANCHES = ['All', 'CSE', 'ECE', 'MECH', 'IT', 'BioTech'];

export default function CuffingPage() {
  const [activeTab, setActiveTab] = useState('events');
  const [eventStatuses, setEventStatuses] = useState({});
  const [showParticipants, setShowParticipants] = useState(null);
  const [branchFilter, setBranchFilter] = useState('All');
  const [sentCuffs, setSentCuffs] = useState([]);

  const toggleGoing = (eventId, status) => {
    setEventStatuses(prev => ({ ...prev, [eventId]: status }));
  };

  const filteredParticipants = branchFilter === 'All'
    ? PARTICIPANTS
    : PARTICIPANTS.filter(p => p.branch === branchFilter);

  const sendCuffRequest = (participantId) => {
    setSentCuffs(prev => [...prev, participantId]);
  };

  return (
    <div className="cuffing-page">
      <div className="cuffing-container">
        <header className="cuffing-header">
          <h1>🎉 Cuffing</h1>
          <p>Find a date for college events</p>
        </header>

        <div className="cuffing-tabs">
          <button
            className={`cuffing-tab ${activeTab === 'events' ? 'active' : ''}`}
            onClick={() => setActiveTab('events')}
          >
            Events
          </button>
          <button
            className={`cuffing-tab ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            My Requests
          </button>
        </div>

        {activeTab === 'events' ? (
          <div className="cuffing-events">
            {EVENTS.map(event => {
              const status = eventStatuses[event.id];
              const isGoing = status === 'going';
              return (
                <article key={event.id} className="cuffing-event-card">
                  <div className={`cuffing-event-banner ${event.banner}`}>
                    <span className="cuffing-event-banner-text">{event.name}</span>
                  </div>
                  <div className="cuffing-event-body">
                    <h3 className="cuffing-event-name">{event.name}</h3>
                    <div className="cuffing-event-details">
                      <span className="cuffing-event-detail">📅 {event.date}</span>
                      <span className="cuffing-event-detail">🕐 {event.time}</span>
                      <span className="cuffing-event-detail">📍 {event.venue}</span>
                    </div>
                    <div className="cuffing-event-footer">
                      <span className="cuffing-event-going">{event.going} people going</span>
                      <div className="cuffing-event-actions">
                        <div className="cuffing-toggle-group">
                          <button
                            className={`cuffing-toggle-btn ${isGoing ? 'active' : ''}`}
                            onClick={() => toggleGoing(event.id, 'going')}
                          >
                            Going
                          </button>
                          <button
                            className={`cuffing-toggle-btn ${status === 'not-going' ? 'active' : ''}`}
                            onClick={() => toggleGoing(event.id, 'not-going')}
                          >
                            Not Going
                          </button>
                        </div>
                        <button
                          className="cuffing-find-btn"
                          disabled={!isGoing}
                          onClick={() => setShowParticipants(event)}
                        >
                          Find a Cuff →
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="cuffing-requests">
            <div className="cuffing-requests-section">
              <h3 className="cuffing-requests-title">Sent Requests</h3>
              {SENT_REQUESTS.map((req, i) => (
                <div key={i} className="cuffing-request-item">
                  <div className="cuffing-request-avatar">{req.initials}</div>
                  <div className="cuffing-request-info">
                    <span className="cuffing-request-name">{req.name}</span>
                    <span className="cuffing-request-event">for {req.event}</span>
                  </div>
                  <span className={`cuffing-request-status ${req.status}`}>
                    {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                  </span>
                </div>
              ))}
            </div>

            <div className="cuffing-requests-section">
              <h3 className="cuffing-requests-title">Received Requests</h3>
              {RECEIVED_REQUESTS.map((req, i) => (
                <div key={i} className="cuffing-request-item">
                  <div className="cuffing-request-avatar">{req.initials}</div>
                  <div className="cuffing-request-info">
                    <span className="cuffing-request-name">{req.name}</span>
                    <span className="cuffing-request-event">for {req.event}</span>
                  </div>
                  <div className="cuffing-request-actions">
                    <button className="cuffing-accept-btn">Accept</button>
                    <button className="cuffing-decline-btn">Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {showParticipants && (
          <div className="cuffing-modal-overlay" onClick={() => setShowParticipants(null)}>
            <div className="cuffing-modal" onClick={e => e.stopPropagation()}>
              <div className="cuffing-modal-header">
                <h2>People going to {showParticipants.name}</h2>
                <button className="cuffing-modal-close" onClick={() => setShowParticipants(null)}>✕</button>
              </div>

              <div className="cuffing-filters">
                {BRANCHES.map(b => (
                  <button
                    key={b}
                    className={`cuffing-filter-btn ${branchFilter === b ? 'active' : ''}`}
                    onClick={() => setBranchFilter(b)}
                  >
                    {b}
                  </button>
                ))}
              </div>

              <div className="cuffing-participants-grid">
                {filteredParticipants.map(p => (
                  <div key={p.id} className="cuffing-participant-card">
                    <div className="cuffing-participant-top">
                      <div className="cuffing-participant-avatar">{p.initials}</div>
                      <div className="cuffing-participant-info">
                        <span className="cuffing-participant-name">{p.name}</span>
                        <span className="cuffing-participant-branch">{p.branch} · {p.year} Year</span>
                      </div>
                    </div>
                    <span className={`cuffing-participant-status ${p.available ? 'available' : 'cuffed'}`}>
                      {p.available ? 'Available' : 'Already Cuffed'}
                    </span>
                    <button
                      className="cuffing-send-btn"
                      disabled={!p.available || sentCuffs.includes(p.id)}
                      onClick={() => sendCuffRequest(p.id)}
                    >
                      {sentCuffs.includes(p.id) ? 'Request Sent ✓' : 'Send Cuff Request 💌'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
