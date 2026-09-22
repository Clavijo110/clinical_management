import express from 'express';
import { query, run, logAudit } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

function getStudentScope(user) {
  if (user.rol === 'director') return { clause: '', params: [] };
  return { clause: 'WHERE s.docente_id = ?', params: [user.id] };
}

router.get('/', requireAuth, requireRole('director', 'docente'), async (req, res) => {
  try {
    const { clause, params } = getStudentScope(req.user);

    const students = await query(`
      SELECT s.*, u.nombre as docente_nombre,
        (SELECT COUNT(*) FROM patients p WHERE p.estudiante_id = s.id AND p.estado = 'activo') as pacientes_activos,
        (SELECT COUNT(*) FROM clinical_sessions cs WHERE cs.estudiante_id = s.id) as atenciones_total
      FROM students s
      LEFT JOIN users u ON u.id = s.docente_id
      ${clause}
      ORDER BY s.created_at DESC
    `, params);

    return res.json(students);
  } catch (error) {
    return res.status(500).json({ message: 'Error al consultar estudiantes.', error: error.message });
  }
});

router.get('/:id', requireAuth, requireRole('director', 'docente'), async (req, res) => {
  try {
    const student = await query(`
      SELECT s.*, u.nombre as docente_nombre
      FROM students s
      LEFT JOIN users u ON u.id = s.docente_id
      WHERE s.id = ?
    `, [req.params.id]);

    if (!student[0]) {
      return res.status(404).json({ message: 'Estudiante no encontrado.' });
    }

    if (req.user.rol === 'docente' && student[0].docente_id !== req.user.id) {
      return res.status(403).json({ message: 'No puede consultar estudiantes de otro docente.' });
    }

    const patients = await query(`
      SELECT p.*
      FROM patients p
      WHERE p.estudiante_id = ?
      ORDER BY p.created_at DESC
    `, [student[0].id]);

    const sessions = await query(`
      SELECT cs.*, p.nombre as paciente_nombre
      FROM clinical_sessions cs
      JOIN patients p ON p.id = cs.paciente_id
      WHERE cs.estudiante_id = ?
      ORDER BY cs.fecha DESC
    `, [student[0].id]);

    return res.json({ student: student[0], patients, sessions });
  } catch (error) {
    return res.status(500).json({ message: 'Error al consultar estudiante.', error: error.message });
  }
});

router.post('/', requireAuth, requireRole('director', 'docente'), async (req, res) => {
  const { nombre, docente_id, semestre_actual, estado = 'activo' } = req.body || {};

  if (!nombre || !semestre_actual) {
    return res.status(400).json({ message: 'Nombre y semestre son obligatorios.' });
  }

  if (semestre_actual < 1 || semestre_actual > 6) {
    return res.status(400).json({ message: 'El semestre debe estar entre 1 y 6.' });
  }

  const assignedDocente = req.user.rol === 'director' ? (docente_id || req.user.id) : req.user.id;

  if (req.user.rol === 'docente' && assignedDocente !== req.user.id) {
    return res.status(403).json({ message: 'Un docente solo puede asignarse a sí mismo.' });
  }

  const id = uuidv4();
  try {
    await run(
      `INSERT INTO students (id, nombre, docente_id, semestre_actual, estado) VALUES (?, ?, ?, ?, ?)`,
      [id, nombre.trim(), assignedDocente, Number(semestre_actual), estado === 'retirado' ? 'retirado' : 'activo']
    );
    await logAudit({
      userId: req.user.id,
      action: 'CREATE',
      entity: 'students',
      entityId: id,
      newValue: { nombre: nombre.trim(), docente_id: assignedDocente, semestre_actual: Number(semestre_actual) }
    });

    return res.status(201).json({ message: 'Estudiante creado correctamente.', id });
  } catch (error) {
    return res.status(500).json({ message: 'Error al crear estudiante.', error: error.message });
  }
});

router.patch('/:id', requireAuth, requireRole('director', 'docente'), async (req, res) => {
  const { id } = req.params;
  const { nombre, docente_id, semestre_actual, estado } = req.body || {};

  try {
    const existing = await query('SELECT * FROM students WHERE id = ?', [id]);
    if (!existing[0]) {
      return res.status(404).json({ message: 'Estudiante no encontrado.' });
    }

    if (req.user.rol === 'docente' && existing[0].docente_id !== req.user.id) {
      return res.status(403).json({ message: 'No puede editar estudiantes de otro docente.' });
    }

    const nextState = estado === 'retirado' ? 'retirado' : 'activo';
    const nextDocente = req.user.rol === 'director' ? (docente_id || existing[0].docente_id) : req.user.id;
    const nextSemestre = semestre_actual ?? existing[0].semestre_actual;

    await run(
      `UPDATE students SET nombre = ?, docente_id = ?, semestre_actual = ?, estado = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [nombre ? nombre.trim() : existing[0].nombre, nextDocente, nextSemestre, nextState, id]
    );

    if (nextState === 'retirado') {
      await run(
        `UPDATE patients SET estudiante_id = NULL, estado = 'sin_asignar', updated_at = CURRENT_TIMESTAMP WHERE estudiante_id = ?`,
        [id]
      );
    }

    await logAudit({
      userId: req.user.id,
      action: 'UPDATE',
      entity: 'students',
      entityId: id,
      oldValue: existing[0],
      newValue: { nombre: nombre ? nombre.trim() : existing[0].nombre, docente_id: nextDocente, semestre_actual: nextSemestre, estado: nextState }
    });

    return res.json({ message: 'Estudiante actualizado.' });
  } catch (error) {
    return res.status(500).json({ message: 'Error al actualizar estudiante.', error: error.message });
  }
});

router.patch('/:id/retire', requireAuth, requireRole('director', 'docente'), async (req, res) => {
  const { id } = req.params;

  try {
    const student = await query('SELECT * FROM students WHERE id = ?', [id]);
    if (!student[0]) {
      return res.status(404).json({ message: 'Estudiante no encontrado.' });
    }

    if (req.user.rol === 'docente' && student[0].docente_id !== req.user.id) {
      return res.status(403).json({ message: 'No puede retirar estudiantes de otro docente.' });
    }

    await run(
      `UPDATE students SET estado = 'retirado', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );
    await run(
      `UPDATE patients SET estudiante_id = NULL, estado = 'sin_asignar', updated_at = CURRENT_TIMESTAMP WHERE estudiante_id = ?`,
      [id]
    );
    await logAudit({
      userId: req.user.id,
      action: 'RETIRE',
      entity: 'students',
      entityId: id,
      oldValue: student[0],
      newValue: { estado: 'retirado', pacientes: 'sin_asignar' }
    });

    return res.json({ message: 'Estudiante retirado; sus pacientes pasaron a sin asignar.' });
  } catch (error) {
    return res.status(500).json({ message: 'Error al retirar estudiante.', error: error.message });
  }
});

export default router;
