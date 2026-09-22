import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendEmail } from '../services/email.js';

const router = express.Router();

router.post('/test-email', requireAuth, requireRole('director'), async (req, res) => {
  const { to } = req.body || {};
  if (!to || !/^\S+@\S+\.\S+$/.test(to)) {
    return res.status(400).json({ message: 'Debe indicar un correo válido.' });
  }

  try {
    await sendEmail({
      to,
      subject: 'Prueba de correo - Sistema de Gestión Clínica UV',
      html: '<p>La integración de correo del Posgrado de Ortodoncia está funcionando correctamente.</p>'
    });
    return res.json({ message: 'Correo de prueba enviado.' });
  } catch (error) {
    return res.status(503).json({ message: error.message });
  }
});

export default router;
