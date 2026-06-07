import { useState, useEffect } from 'react';
import { anonymousAPI } from '../utils/api';
import '../styles/anonymous.css';

const MOCK_POSTS = [
  { id: 'A7K2', text: 'Just had the best chai at V3 canteen. If you know, you know. ☕', time: '2m ago', reactions: { '👍': 12, '👎': 1, '😂': 4, '😮': 0 } },
  { id: 'B3M9', text: 'To the person who returned my laptop charger in the library — you literally saved my assignment. Thank you, stranger!', time: '8m ago', reactions: { '👍': 34, '👎': 0, '😂': 2, '😮': 5 } },
  { id: 'C1P5', text: 'Hot take: 8 AM classes should be illegal. I said what I said.', time: '15m ago', reactions: { '👍': 67, '👎': 3, '😂': 45, '😮': 1 } },
  { id: 'D9X4', text: 'The WiFi in hostel block C has been down for 3 days. Admin, if you\'re reading this... PLEASE FIX IT.', time: '22m ago', reactions: { '👍': 89, '👎': 0, '😂': 12, '😮': 3 } },
  { id: 'E6W1', text: 'Saw two cats fighting near the academic block. Highlight of my day honestly.', time: '35m ago', reactions: { '👍': 28, '👎': 2, '😂': 56, '😮': 8 } },
  { id: 'F2K8', text: 'Just finished my last exam this semester. The freedom feels UNREAL. 🎉', time: '1h ago', reactions: { '👍': 102, '👎': 0, '😂': 15, '😮': 2 } },
  { id: 'G5N3', text: 'Confession: I\'ve been going to the wrong class for 2 weeks and only realized today when the professor called attendance.', time: '2h ago', reactions: { '👍': 5, '👎': 1, '😂': 134, '😮': 45 } },
  { id: 'H8R6', text: 'The sunset from the rooftop of TT today was absolutely breathtaking. Sometimes this campus really surprises you. 🌅', time: '3h ago', reactions: { '👍': 76, '👎': 0, '😂': 3, '😮': 22 } },
];

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
  const [posts, setPosts] = useState(MOCK_POSTS);
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
        setPosts(apiPosts.length > 0 ? apiPosts : MOCK_POSTS);
      } catch (err) {
        console.warn('Failed to fetch anonymous posts, using mock data:', err.message);
        setPosts(MOCK_POSTS);
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
