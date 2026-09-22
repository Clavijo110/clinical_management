import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { query } from '../config/db.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret-uv-clinical';

export function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email, rol: user.rol }, JWT_SECRET, {
    expiresIn: '8h'
  });
}

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token no proporcionado.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const rows = await query('SELECT * FROM users WHERE id = ?', [payload.id]);

    if (!rows[0]) {
      return res.status(401).json({ message: 'Usuario no válido.' });
    }

    req.user = rows[0];
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido o expirado.' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'No autenticado.' });
    }

    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ message: 'No tiene permisos para esta acción.' });
    }

    next();
  };
}

export function onlyOwnOrDirector(getUserIdFn) {
  return async (req, res, next) => {
    if (req.user.rol === 'director') {
      return next();
    }

    const targetUserId = getUserIdFn(req);
    if (!targetUserId || targetUserId !== req.user.id) {
      return res.status(403).json({ message: 'No tiene permisos sobre esta información.' });
    }

    next();
  };
}
