import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { playbackManager } from './utils/playbackManager';
import AuthPage from './pages/AuthPage';
import ChatPage from './pages/ChatPage';
import NotFound from './pages/NotFound';
import Loader from './components/ui/Loader';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, needsProfile, needsVoiceEnrollment } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-primary">
        <Loader size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // If user hasn't finished onboarding (profile or voice), send back to auth page
  if (needsProfile || needsVoiceEnrollment) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading, needsProfile, needsVoiceEnrollment } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-primary">
        <Loader size="lg" />
      </div>
    );
  }

  // Only send to chat once onboarding (profile + voice enrollment) is done.
  if (isAuthenticated && !needsProfile && !needsVoiceEnrollment) {
    return <Navigate to="/chat" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicRoute>
            <AuthPage />
          </PublicRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat/:conversationId"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  // Stop all voice playback when the tab is hidden / the page is being hidden,
  // so the browser can't auto-resume queued speech on tab-switch or Mac wake.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') playbackManager.stopAll();
    };
    const onPageHide = () => playbackManager.stopAll();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <AppRoutes />
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
