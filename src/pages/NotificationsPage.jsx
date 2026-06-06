import { useState } from 'react'
import '../styles/notifications.css'

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
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

  const unreadCount = notifications.filter((n) => n.unread).length

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
  }

  return (
    <div className="notifications-page">
      <div className="notifications-header">
        <h1 className="notifications-title">
          Notifications {unreadCount > 0 && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 400 }}>({unreadCount} new)</span>}
        </h1>
        {unreadCount > 0 && (
          <button className="notifications-mark-read" onClick={markAllRead}>
            Mark all as read
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
