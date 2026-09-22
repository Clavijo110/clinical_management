import express from 'express';
import bcrypt from 'bcryptjs';
import { query, logAudit } from '../config/db.js';
import { generateToken, requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Correo y contraseña son obligatorios.' });
  }

  try {
    const users = await query('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    const user = users[0];

    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    const passwordOk = await bcrypt.compare(password, user.password_hash);
    if (!passwordOk) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    if (!['director', 'docente'].includes(user.rol)) {
      return res.status(403).json({ message: 'Rol no permitido en el sistema.' });
    }

    const token = generateToken(user);
    await logAudit({
      userId: user.id,
      action: 'LOGIN',
      entity: 'users',
      entityId: user.id,
      newValue: { email: user.email }
    });
    const { password_hash, ...safeUser } = user;

    return res.json({ token, user: safeUser });
  } catch (error) {
    return res.status(500).json({ message: 'Error al iniciar sesión.', error: error.message });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const { password_hash, ...safeUser } = req.user;
  return res.json({ user: safeUser });
});

export default router;
