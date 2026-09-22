import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/health', requireAuth, requireRole('director', 'docente'), async (req, res) => {
  return res.json({ ok: true, message: 'Report service ready.' });
});

export default router;
