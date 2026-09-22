import { useState } from 'react';
import UniversityBrand from '../components/UniversityBrand.jsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('director@uv.edu.co');
  const [password, setPassword] = useState('Admin123!');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Error de autenticación');

      onLogin(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-visual">
        <UniversityBrand inverse />
        <div className="login-visual-copy">
          <span className="eyebrow">CLÍNICA ACADÉMICA</span>
          <h1>Gestión clínica con criterio universitario.</h1>
          <p>Centraliza el seguimiento de residentes, pacientes y atenciones del Posgrado de Ortodoncia.</p>
        </div>
        <div className="login-visual-footer">UNIVERSIDAD DEL VALLE · CALI, COLOMBIA</div>
      </div>

      <div className="login-card">
        <div className="login-card-header">
          <span className="eyebrow">ACCESO PRIVADO</span>
          <h2>Bienvenido</h2>
          <p>Inicia sesión para continuar con la gestión de la clínica.</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            Correo o usuario
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="director@uv.edu.co"
            />
          </label>

          <label>
            Contraseña
            <div className="password-row">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPassword((prev) => !prev)}>
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </label>

          {error && <div className="error-box">{error}</div>}

          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className="demo-credentials">
          <strong>Entorno de demostración</strong>
          <div>Director: director@uv.edu.co / Admin123!</div>
          <div>Docente: docente1@uv.edu.co / Docente123!</div>
        </div>
      </div>
    </div>
  );
}
