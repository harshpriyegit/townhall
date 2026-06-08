import { useState, useEffect } from 'react'
import { notificationsAPI } from '../utils/api'
import '../styles/notifications.css'

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD}d ago`
  return date.toLocaleDateString()
}

const ICON_MAP = {
  like: '❤️',
  comment: '💬',
  follow: '👤',
  mention: '@',
  event: '🎉',
  connect_request: '🌐',
  match: '🤝',
}

const MOCK_NOTIFICATIONS = [
  {
    id: 1,
    type: 'like',
    icon: '❤️',
    user: 'Priya Sharma',
    text: '<strong>Priya Sharma</strong> liked your post about semester projects',
    time: '2m ago',
    unread: true,
  },
  {
    id: 2,
    type: 'comment',
    icon: '💬',
    user: 'Arjun Kumar',
    text: '<strong>Arjun Kumar</strong> commented on your post: "Great work!"',
    time: '15m ago',
    unread: true,
  },
  {
    id: 3,
    type: 'follow',
    icon: '👤',
    user: 'Sneha Patel',
    text: '<strong>Sneha Patel</strong> started following you',
    time: '1h ago',
    unread: true,
  },
  {
    id: 4,
    type: 'mention',
    icon: '@',
    user: 'Rahul Verma',
    text: '<strong>Rahul Verma</strong> mentioned you in a post about the hackathon',
    time: '2h ago',
    unread: true,
  },
  {
    id: 5,
    type: 'like',
    icon: '❤️',
    user: 'Vikram Singh',
    text: '<strong>Vikram Singh</strong> and <strong>3 others</strong> liked your photo',
    time: '3h ago',
    unread: false,
  },
  {
    id: 6,
    type: 'event',
    icon: '🎉',
    user: 'TownHall',
    text: '<strong>Campus Fest 2026</strong> is happening this weekend! Don\'t miss out',
    time: '5h ago',
    unread: false,
  },
  {
    id: 7,
    type: 'comment',
    icon: '💬',
    user: 'Meera Nair',
    text: '<strong>Meera Nair</strong> replied to your comment: "Totally agree!"',
    time: '8h ago',
    unread: false,
  },
  {
    id: 8,
    type: 'follow',
    icon: '👤',
    user: 'Karthik Reddy',
    text: '<strong>Karthik Reddy</strong> started following you',
    time: '1d ago',
    unread: false,
  },
  {
    id: 9,
    type: 'like',
    icon: '❤️',
    user: 'Ananya Gupta',
    text: '<strong>Ananya Gupta</strong> liked your comment on Rahul\'s post',
    time: '1d ago',
    unread: false,
  },
  {
    id: 10,
    type: 'event',
    icon: '🎉',
    user: 'TownHall',
    text: '<strong>Placement Drive</strong> — Top companies visiting next week. Register now!',
    time: '2d ago',
    unread: false,
  },
]

function NotificationsPage() {
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS)
  const [isLoading, setIsLoading] = useState(true)
  const [markingRead, setMarkingRead] = useState(false)

  const unreadCount = notifications.filter((n) => n.unread).length

  // Fetch notifications from API on mount
  useEffect(() => {
    let cancelled = false

    async function fetchNotifications() {
      try {
        const data = await notificationsAPI.getAll()
        if (cancelled) return
        const apiNotifs = (data.notifications || data || []).map((n) => ({
          id: n._id || n.id,
          type: n.type || 'like',
          icon: ICON_MAP[n.type] || '🔔',
          user: n.sender?.fullName || n.user || 'Someone',
          text: n.message || n.text || `<strong>${n.sender?.fullName || 'Someone'}</strong> interacted with your content`,
          time: timeAgo(n.createdAt) || n.time || '',
          unread: !n.read,
        }))
        setNotifications(apiNotifs.length > 0 ? apiNotifs : MOCK_NOTIFICATIONS)
      } catch (err) {
        console.warn('Failed to fetch notifications, using mock data:', err.message)
        setNotifications(MOCK_NOTIFICATIONS)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchNotifications()
    return () => { cancelled = true }
  }, [])

  const markAllRead = async () => {
    setMarkingRead(true)
    // Optimistic
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))

    try {
      await notificationsAPI.markAllRead()
    } catch (err) {
      console.warn('Mark all read API failed:', err.message)
      // Already looks fine locally, no revert needed for UX
    } finally {
      setMarkingRead(false)
    }
  }

  if (isLoading) {
    return (
      <div className="notifications-page">
        <div className="notifications-header">
          <h1 className="notifications-title">Notifications</h1>
        </div>
        <div className="notifications-list">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="notification-item" style={{ opacity: 0.5 }}>
              <div className="notification-avatar" style={{ background: '#F0F0F0', color: 'transparent' }}>??</div>
              <div className="notification-body">
                <div style={{ width: '80%', height: '14px', background: '#F0F0F0', borderRadius: '4px', marginBottom: '6px' }} />
                <div style={{ width: '60px', height: '12px', background: '#F5F5F5', borderRadius: '4px' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="notifications-page">
      <div className="notifications-header">
        <h1 className="notifications-title">
          Notifications {unreadCount > 0 && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 400 }}>({unreadCount} new)</span>}
        </h1>
        {unreadCount > 0 && (
          <button
            className="notifications-mark-read"
            onClick={markAllRead}
            disabled={markingRead}
          >
            {markingRead ? 'Marking...' : 'Mark all as read'}
          </button>
        )}
      </div>

      <div className="notifications-list">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            className={`notification-item${notif.unread ? ' unread' : ''}`}
          >
            <div className="notification-avatar">
              {getInitials(notif.user)}
            </div>
            <div className="notification-body">
              <p
                className="notification-text"
                dangerouslySetInnerHTML={{ __html: notif.text }}
              />
              <span className="notification-time">{notif.time}</span>
            </div>
            <div className={`notification-icon ${notif.type}`}>
              {notif.icon}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default NotificationsPage
