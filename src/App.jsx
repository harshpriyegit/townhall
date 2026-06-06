import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import LandingPage from './pages/LandingPage'
import CollegeSelectPage from './pages/CollegeSelectPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import AppLayout from './layouts/AppLayout'
import HomePage from './pages/HomePage'
import ProfilePage from './pages/ProfilePage'
import MessagesPage from './pages/MessagesPage'
import NotificationsPage from './pages/NotificationsPage'
import AnonymousPage from './pages/AnonymousPage'
import VoiceRoomsPage from './pages/VoiceRoomsPage'
import StudyRoomsPage from './pages/StudyRoomsPage'
import DatingPage from './pages/DatingPage'
import CuffingPage from './pages/CuffingPage'
import RadarPage from './pages/RadarPage'
import './styles/index.css'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes — no navbar/sidebar */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/colleges" element={<CollegeSelectPage />} />
          <Route path="/:collegeSlug/login" element={<LoginPage />} />
          <Route path="/:collegeSlug/signup" element={<SignupPage />} />

          {/* Protected routes — wrapped in AppLayout */}
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="profile/:username" element={<ProfilePage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="anonymous" element={<AnonymousPage />} />
            <Route path="voice-rooms" element={<VoiceRoomsPage />} />
            <Route path="study-rooms" element={<StudyRoomsPage />} />
            <Route path="dating" element={<DatingPage />} />
            <Route path="cuffing" element={<CuffingPage />} />
            <Route path="radar" element={<RadarPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
