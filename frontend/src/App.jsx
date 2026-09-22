import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function App() {
  const [authState, setAuthState] = useState(() => {
    const token = localStorage.getItem('uv_token');
    const user = localStorage.getItem('uv_user');
    return {
      token: token || null,
      user: user ? JSON.parse(user) : null,
      loading: true
    };
  });

  useEffect(() => {
    const token = localStorage.getItem('uv_token');
    if (!token) {
      setAuthState({ token: null, user: null, loading: false });
      return;
    }

    fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (!res.ok) throw new Error('Session invalid');
        return res.json();
      })
      .then((data) => {
        localStorage.setItem('uv_user', JSON.stringify(data.user));
        setAuthState({ token, user: data.user, loading: false });
      })
      .catch(() => {
        localStorage.removeItem('uv_token');
        localStorage.removeItem('uv_user');
        setAuthState({ token: null, user: null, loading: false });
      });
  }, []);

  const login = (token, user) => {
    localStorage.setItem('uv_token', token);
    localStorage.setItem('uv_user', JSON.stringify(user));
    setAuthState({ token, user, loading: false });
  };

  const logout = () => {
    localStorage.removeItem('uv_token');
    localStorage.removeItem('uv_user');
    setAuthState({ token: null, user: null, loading: false });
  };

  if (authState.loading) {
    return <div className="app-loading">Cargando sistema...</div>;
  }

  return (
    <Routes>
      <Route path="/" element={authState.token ? <DashboardPage user={authState.user} onLogout={logout} /> : <Navigate to="/login" replace />} />
      <Route path="/login" element={authState.token ? <Navigate to="/" replace /> : <LoginPage onLogin={login} />} />
      <Route path="*" element={<Navigate to={authState.token ? '/' : '/login'} replace />} />
    </Routes>
  );
}

export default App;
