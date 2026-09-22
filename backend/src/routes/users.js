import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query, run, logAudit } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, requireRole('director', 'docente'), async (req, res) => {
  try {
    const rows = await query(
      `SELECT id, nombre, email, rol FROM users WHERE (? = 'director' OR id = ?) ORDER BY nombre`,
      [req.user.rol, req.user.id]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Error al consultar usuarios.', error: error.message });
  }
});

router.post('/', requireAuth, requireRole('director'), async (req, res) => {
  const { nombre, email, password, rol = 'docente' } = req.body || {};

  if (!nombre?.trim() || !email?.trim() || !password || rol !== 'docente') {
    return res.status(400).json({ message: 'Nombre, correo, contraseña y rol docente son obligatorios.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres.' });
  }

  try {
    const existing = await query('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing[0]) return res.status(409).json({ message: 'Ya existe un usuario con ese correo.' });

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);
    await run(
      `INSERT INTO users (id, nombre, email, rol, password_hash) VALUES (?, ?, ?, 'docente', ?)`,
      [id, nombre.trim(), email.trim().toLowerCase(), passwordHash]
    );
    await logAudit({
      userId: req.user.id,
      action: 'CREATE',
      entity: 'users',
      entityId: id,
      newValue: { nombre: nombre.trim(), email: email.trim().toLowerCase(), rol: 'docente' }
    });

    return res.status(201).json({ message: 'Docente creado correctamente.', id });
  } catch (error) {
    return res.status(500).json({ message: 'Error al crear docente.', error: error.message });
  }
});

export default router;
