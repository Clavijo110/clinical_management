import express from 'express';
import { query } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, requireRole('director', 'docente'), async (req, res) => {
  try {
    const rows = await query(`
      SELECT a.*, u.nombre as usuario_nombre
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE (? = 'director' OR a.user_id = ?)
      ORDER BY a.created_at DESC
      LIMIT 50
    `, [req.user.rol, req.user.id]);

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Error al consultar auditoría.', error: error.message });
  }
});

export default router;
