import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, run, logAudit } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, requireRole('director', 'docente'), async (req, res) => {
  try {
    const rows = await query(`
      SELECT cs.*, p.nombre as paciente_nombre, s.nombre as estudiante_nombre, u.nombre as docente_nombre
      FROM clinical_sessions cs
      JOIN patients p ON p.id = cs.paciente_id
      JOIN students s ON s.id = cs.estudiante_id
      JOIN users u ON u.id = s.docente_id
      WHERE (? = 'director' OR s.docente_id = ?)
      ORDER BY cs.fecha DESC
    `, [req.user.rol, req.user.id]);

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Error al consultar atenciones.', error: error.message });
  }
});

router.get('/patient/:patientId', requireAuth, requireRole('director', 'docente'), async (req, res) => {
  try {
    const sessions = await query(`
      SELECT cs.*, s.nombre as estudiante_nombre
      FROM clinical_sessions cs
      JOIN students s ON s.id = cs.estudiante_id
      WHERE cs.paciente_id = ? AND (? = 'director' OR s.docente_id = ?)
      ORDER BY cs.fecha DESC
    `, [req.params.patientId, req.user.rol, req.user.id]);

    return res.json(sessions);
  } catch (error) {
    return res.status(500).json({ message: 'Error al consultar historial clínico.', error: error.message });
  }
});

router.post('/', requireAuth, requireRole('director', 'docente'), async (req, res) => {
  const { paciente_id, estudiante_id, fecha, procedimiento, observaciones, semestre } = req.body || {};

  if (!paciente_id || !estudiante_id || !fecha || !procedimiento || !semestre) {
    return res.status(400).json({ message: 'Paciente, estudiante, fecha, procedimiento y semestre son obligatorios.' });
  }

  try {
    const patient = await query('SELECT * FROM patients WHERE id = ?', [paciente_id]);
    if (!patient[0]) return res.status(404).json({ message: 'Paciente no encontrado.' });

    const student = await query('SELECT * FROM students WHERE id = ?', [estudiante_id]);
    if (!student[0]) return res.status(404).json({ message: 'Estudiante no encontrado.' });

    if (req.user.rol === 'docente' && student[0].docente_id !== req.user.id) {
      return res.status(403).json({ message: 'No puede registrar atenciones para un estudiante ajeno.' });
    }

    if (patient[0].estudiante_id && patient[0].estudiante_id !== estudiante_id) {
      return res.status(400).json({ message: 'La atención debe pertenecer al estudiante asignado al paciente.' });
    }
    if (Number(semestre) < 1 || Number(semestre) > 6) {
      return res.status(400).json({ message: 'El semestre debe estar entre 1 y 6.' });
    }

    const id = uuidv4();
    await run(`
      INSERT INTO clinical_sessions (id, paciente_id, estudiante_id, fecha, procedimiento, observaciones, semestre)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, paciente_id, estudiante_id, fecha, procedimiento.trim(), observaciones || '', Number(semestre)]);
    await logAudit({
      userId: req.user.id,
      action: 'CREATE',
      entity: 'clinical_sessions',
      entityId: id,
      newValue: { paciente_id, estudiante_id, fecha, procedimiento: procedimiento.trim(), semestre: Number(semestre) }
    });

    return res.status(201).json({ message: 'Atención registrada correctamente.', id });
  } catch (error) {
    return res.status(500).json({ message: 'Error al registrar atención.', error: error.message });
  }
});

export default router;
