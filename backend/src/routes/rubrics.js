import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, run, logAudit } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, requireRole('director', 'docente'), async (req, res) => {
  try {
    const rows = await query(`
      SELECT r.*, e.valor, e.porcentaje
      FROM rubrics r
      LEFT JOIN rubric_evaluations e ON e.rubric_id = r.id
      WHERE (? = 'director' OR r.activo = 1)
      ORDER BY r.semestre, r.nombre
    `, [req.user.rol]);

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Error al consultar rúbricas.', error: error.message });
  }
});

router.get('/student/:studentId', requireAuth, requireRole('director', 'docente'), async (req, res) => {
  try {
    const student = await query('SELECT * FROM students WHERE id = ?', [req.params.studentId]);
    if (!student[0]) return res.status(404).json({ message: 'Estudiante no encontrado.' });
    if (req.user.rol === 'docente' && student[0].docente_id !== req.user.id) {
      return res.status(403).json({ message: 'No puede consultar rúbricas de otro docente.' });
    }

    const rubricRows = await query(`
      SELECT r.*, e.valor, e.porcentaje, e.fecha
      FROM rubrics r
      LEFT JOIN rubric_evaluations e ON e.rubric_id = r.id AND e.estudiante_id = ?
      WHERE r.activo = 1
      ORDER BY r.semestre, r.nombre
    `, [req.params.studentId]);

    return res.json(rubricRows);
  } catch (error) {
    return res.status(500).json({ message: 'Error al consultar rúbricas del estudiante.', error: error.message });
  }
});

router.post('/', requireAuth, requireRole('director', 'docente'), async (req, res) => {
  const { semestre, nombre, descripcion, peso_meta } = req.body || {};

  if (!semestre || !nombre?.trim() || peso_meta === undefined) {
    return res.status(400).json({ message: 'Semestre, nombre y meta son obligatorios.' });
  }
  if (Number(semestre) < 1 || Number(semestre) > 6 || Number(peso_meta) <= 0) {
    return res.status(400).json({ message: 'Semestre o meta inválidos.' });
  }

  try {
    const id = uuidv4();
    await run(`
      INSERT INTO rubrics (id, semestre, nombre, descripcion, peso_meta, activo)
      VALUES (?, ?, ?, ?, ?, 1)
    `, [id, Number(semestre), nombre.trim(), descripcion || '', Number(peso_meta)]);
    await logAudit({
      userId: req.user.id,
      action: 'CREATE',
      entity: 'rubrics',
      entityId: id,
      newValue: { semestre: Number(semestre), nombre: nombre.trim(), peso_meta: Number(peso_meta) }
    });

    return res.status(201).json({ message: 'Rúbrica creada correctamente.', id });
  } catch (error) {
    return res.status(500).json({ message: 'Error al crear rúbrica.', error: error.message });
  }
});

router.post('/evaluate', requireAuth, requireRole('director', 'docente'), async (req, res) => {
  const { estudiante_id, rubric_id, valor, porcentaje } = req.body || {};

  if (!estudiante_id || !rubric_id || valor === undefined || porcentaje === undefined) {
    return res.status(400).json({ message: 'Estudiante, rúbrica, valor y porcentaje son obligatorios.' });
  }

  try {
    const student = await query('SELECT * FROM students WHERE id = ?', [estudiante_id]);
    if (!student[0]) return res.status(404).json({ message: 'Estudiante no encontrado.' });
    if (req.user.rol === 'docente' && student[0].docente_id !== req.user.id) {
      return res.status(403).json({ message: 'No puede evaluar a un estudiante ajeno.' });
    }
    const rubric = await query('SELECT * FROM rubrics WHERE id = ? AND activo = 1', [rubric_id]);
    if (!rubric[0]) return res.status(404).json({ message: 'Rúbrica no encontrada.' });
    if (Number(valor) < 0 || Number(porcentaje) < 0 || Number(porcentaje) > 100) {
      return res.status(400).json({ message: 'La evaluación debe estar entre 0 y 100.' });
    }
    const current = await query('SELECT * FROM rubric_evaluations WHERE estudiante_id = ? AND rubric_id = ?', [estudiante_id, rubric_id]);
    const id = current[0]?.id || uuidv4();

    if (current[0]) {
      await run(`
        UPDATE rubric_evaluations
        SET valor = ?, porcentaje = ?, fecha = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [Number(valor), Number(porcentaje), id]);
    } else {
      await run(`
        INSERT INTO rubric_evaluations (id, rubric_id, estudiante_id, valor, porcentaje, fecha)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [id, rubric_id, estudiante_id, Number(valor), Number(porcentaje)]);
    }

    await logAudit({
      userId: req.user.id,
      action: current[0] ? 'UPDATE' : 'CREATE',
      entity: 'rubric_evaluations',
      entityId: id,
      oldValue: current[0] || null,
      newValue: { estudiante_id, rubric_id, valor: Number(valor), porcentaje: Number(porcentaje) }
    });

    return res.json({ message: 'Evaluación actualizada correctamente.' });
  } catch (error) {
    return res.status(500).json({ message: 'Error al evaluar rúbrica.', error: error.message });
  }
});

export default router;
