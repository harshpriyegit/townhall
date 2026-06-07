import { useState, useEffect } from 'react';
import { anonymousAPI } from '../utils/api';
import '../styles/anonymous.css';

const VOICE_ROOMS = [
  { id: 1, name: 'Late Night Talks', listeners: 12, topic: 'chill' },
  { id: 2, name: 'Confessions', listeners: 27, topic: 'confessions' },
  { id: 3, name: 'College Gossip', listeners: 8, topic: 'gossip' },
  { id: 4, name: 'Random Vibes', listeners: 5, topic: 'random' },
];

const REACTION_EMOJIS = ['👍', '👎', '😂', '😮'];

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return date.toLocaleDateString();
}

export default function AnonymousPage() {
  const [postText, setPostText] = useState('');
  const [posts, setPosts] = useState([]);
  const [activeReactions, setActiveReactions] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);

  // Fetch anonymous posts from API
  useEffect(() => {
    let cancelled = false;

    async function fetchPosts() {
      try {
        const data = await anonymousAPI.getAll();
        if (cancelled) return;
        const apiPosts = (data.posts || data || []).map((p) => ({
          id: p._id || p.id,
          text: p.content || p.text || '',
          time: timeAgo(p.createdAt) || p.time || '',
          reactions: p.reactions || { '👍': 0, '👎': 0, '😂': 0, '😮': 0 },
        }));
        setPosts(apiPosts);
      } catch (err) {
        console.warn('Failed to fetch anonymous posts, showing empty wall:', err.message);
        setPosts([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchPosts();
    return () => { cancelled = true; };
  }, []);

  const handlePost = async () => {
    if (!postText.trim()) return;
    setIsPosting(true);

    try {
      const data = await anonymousAPI.create(postText.trim());
      const newPost = {
        id: data.post?._id || data._id || Math.random().toString(36).substring(2, 6).toUpperCase(),
        text: postText.trim(),
        time: 'Just now',
        reactions: { '👍': 0, '👎': 0, '😂': 0, '😮': 0 },
      };
      setPosts([newPost, ...posts]);
      setPostText('');
    } catch (err) {
      console.warn('Failed to create anonymous post via API, saving locally:', err.message);
      const newId = Math.random().toString(36).substring(2, 6).toUpperCase();
      const newPost = {
        id: newId,
        text: postText.trim(),
        time: 'Just now',
        reactions: { '👍': 0, '👎': 0, '😂': 0, '😮': 0 },
      };
      setPosts([newPost, ...posts]);
      setPostText('');
    } finally {
      setIsPosting(false);
    }
  };

  const toggleReaction = async (postId, emoji) => {
    const key = `${postId}-${emoji}`;
    const isActive = activeReactions[key];

    // Optimistic update
    setActiveReactions(prev => ({ ...prev, [key]: !isActive }));
    setPosts(prev =>
      prev.map(p =>
        p.id === postId
          ? {
              ...p,
              reactions: {
                ...p.reactions,
                [emoji]: (p.reactions[emoji] || 0) + (isActive ? -1 : 1),
              },
            }
          : p
      )
    );

    try {
      await anonymousAPI.react(postId, emoji);
    } catch (err) {
      console.warn('Reaction API failed:', err.message);
      // Revert on failure
      setActiveReactions(prev => ({ ...prev, [key]: isActive }));
      setPosts(prev =>
        prev.map(p =>
          p.id === postId
            ? {
                ...p,
                reactions: {
                  ...p.reactions,
                  [emoji]: (p.reactions[emoji] || 0) + (isActive ? 1 : -1),
                },
              }
            : p
        )
      );
    }
  };

  return (
    <div className="anonymous-page">
      <div className="anonymous-container">
        <header className="anonymous-header">
          <h1>🎭 Anonymous Wall</h1>
          <p>Post freely. No identity attached.</p>
        </header>

        <div className="anonymous-layout">
          {/* Main Feed */}
          <main>
            {/* Compose */}
            <div className="anon-compose">
              <div className="anon-compose-header">
                <div className="anon-compose-avatar">👤</div>
                <span className="anon-compose-label">Your identity is hidden</span>
              </div>
              <textarea
                value={postText}
                onChange={e => setPostText(e.target.value)}
                placeholder="Share something anonymously..."
                maxLength={500}
                disabled={isPosting}
              />
              <div className="anon-compose-actions">
                <button
                  className="anon-post-btn"
                  onClick={handlePost}
                  disabled={!postText.trim() || isPosting}
                >
                  {isPosting ? 'Posting...' : 'Post Anonymously'}
                </button>
              </div>
            </div>

            {/* Feed */}
            <div className="anon-feed">
              {isLoading ? (
                [1, 2, 3].map((i) => (
                  <article key={i} className="anon-post-card" style={{ opacity: 0.5 }}>
                    <div className="anon-post-header">
                      <div className="anon-avatar" style={{ background: '#F0F0F0' }}>👤</div>
                      <div className="anon-post-meta">
                        <div style={{ width: '120px', height: '14px', background: '#F0F0F0', borderRadius: '4px', marginBottom: '4px' }} />
                        <div style={{ width: '60px', height: '12px', background: '#F5F5F5', borderRadius: '4px' }} />
                      </div>
                    </div>
                    <div style={{ width: '100%', height: '14px', background: '#F5F5F5', borderRadius: '4px', marginBottom: '8px' }} />
                    <div style={{ width: '70%', height: '14px', background: '#F5F5F5', borderRadius: '4px' }} />
                  </article>
                ))
              ) : (
                posts.map(post => (
                  <article key={post.id} className="anon-post-card">
                    <div className="anon-post-header">
                      <div className="anon-avatar">👤</div>
                      <div className="anon-post-meta">
                        <div className="anon-post-name">
                          Anonymous
                          <span className="anon-post-id">#{typeof post.id === 'string' ? post.id.slice(-4).toUpperCase() : post.id}</span>
                        </div>
                        <div className="anon-post-time">{post.time}</div>
                      </div>
                    </div>
                    <p className="anon-post-body">{post.text}</p>
                    <div className="anon-reactions">
                      {REACTION_EMOJIS.map(emoji => (
                        <button
                          key={emoji}
                          className={`anon-reaction-btn ${activeReactions[`${post.id}-${emoji}`] ? 'active' : ''}`}
                          onClick={() => toggleReaction(post.id, emoji)}
                        >
                          <span>{emoji}</span>
                          <span className="anon-reaction-count">{post.reactions?.[emoji] || 0}</span>
                        </button>
                      ))}
                      <button className="anon-report-btn">⚑ Report</button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </main>

          {/* Voice Rooms Sidebar */}
          <aside className="voice-rooms-sidebar">
            <div className="voice-rooms-card">
              <h3 className="voice-rooms-title">🎙️ Live Voice Rooms</h3>
              {VOICE_ROOMS.map(room => (
                <div key={room.id} className="voice-room-item">
                  <div className="voice-room-top">
                    <span className="voice-room-name">{room.name}</span>
                    <span className="voice-room-live">
                      <span className="voice-room-live-dot" />
                      Live
                    </span>
                  </div>
                  <div className="voice-room-info">
                    <span className="voice-room-listeners">🎙️ {room.listeners} listening</span>
                    <button className="voice-room-join-btn">Join</button>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
