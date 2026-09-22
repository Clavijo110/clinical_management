import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';
import { query, run, logAudit } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
const uploadsDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');

function getPatientScope(user) {
  if (user.rol === 'director') {
    return { clause: '', params: [] };
  }

  return {
    clause: 'WHERE p.estudiante_id IN (SELECT id FROM students WHERE docente_id = ?)',
    params: [user.id]
  };
}

router.get('/', requireAuth, requireRole('director', 'docente'), async (req, res) => {
  try {
    const { clause, params } = getPatientScope(req.user);
    const patients = await query(`
      SELECT p.*, s.nombre as estudiante_nombre, u.nombre as docente_nombre
      FROM patients p
      LEFT JOIN students s ON s.id = p.estudiante_id
      LEFT JOIN users u ON u.id = s.docente_id
      ${clause}
      ORDER BY p.created_at DESC
    `, params);

    return res.json(patients);
  } catch (error) {
    return res.status(500).json({ message: 'Error al consultar pacientes.', error: error.message });
  }
});

router.get('/unassigned', requireAuth, requireRole('director', 'docente'), async (req, res) => {
  try {
    const patients = await query(`
      SELECT p.*, s.nombre as estudiante_anterior
      FROM patients p
      LEFT JOIN students s ON s.id = p.estudiante_id
      WHERE p.estado = 'sin_asignar' AND (? = 'director' OR p.estudiante_id IS NULL OR s.docente_id = ?)
      ORDER BY p.created_at DESC
    `, [req.user.rol, req.user.id]);

    return res.json(patients);
  } catch (error) {
    return res.status(500).json({ message: 'Error al consultar pacientes sin asignar.', error: error.message });
  }
});

router.get('/:id', requireAuth, requireRole('director', 'docente'), async (req, res) => {
  try {
    const patient = await query(`
      SELECT p.*, s.nombre as estudiante_nombre, u.nombre as docente_nombre
      FROM patients p
      LEFT JOIN students s ON s.id = p.estudiante_id
      LEFT JOIN users u ON u.id = s.docente_id
      WHERE p.id = ?
    `, [req.params.id]);

    if (!patient[0]) {
      return res.status(404).json({ message: 'Paciente no encontrado.' });
    }

    if (req.user.rol === 'docente' && patient[0].estudiante_id) {
      const owner = await query('SELECT docente_id FROM students WHERE id = ?', [patient[0].estudiante_id]);
      if (owner[0]?.docente_id !== req.user.id) {
        return res.status(403).json({ message: 'No puede consultar pacientes ajenos.' });
      }
    }

    const sessions = await query(`
      SELECT cs.*, s.nombre as estudiante_nombre
      FROM clinical_sessions cs
      JOIN students s ON s.id = cs.estudiante_id
      WHERE cs.paciente_id = ?
      ORDER BY cs.fecha DESC
    `, [req.params.id]);

    return res.json({ patient: patient[0], sessions });
  } catch (error) {
    return res.status(500).json({ message: 'Error al consultar detalle del paciente.', error: error.message });
  }
});

router.post('/', requireAuth, requireRole('director', 'docente'), async (req, res) => {
  const { nombre, telefono, edad, diagnostico, tipo_maloclusion, quirurgico, extracciones, notas, estudiante_id, semestre, fecha_ingreso } = req.body || {};

  if (!nombre?.trim() || !semestre || !fecha_ingreso) {
    return res.status(400).json({ message: 'Nombre, semestre y fecha de ingreso son obligatorios.' });
  }

  if (Number(semestre) < 1 || Number(semestre) > 6 || (edad !== null && edad !== undefined && (Number(edad) < 0 || Number(edad) > 120))) {
    return res.status(400).json({ message: 'Los datos clínicos o el semestre no son válidos.' });
  }

  if (estudiante_id) {
    const student = await query('SELECT * FROM students WHERE id = ?', [estudiante_id]);
    if (!student[0]) {
      return res.status(404).json({ message: 'Estudiante no encontrado.' });
    }
    if (req.user.rol === 'docente' && student[0].docente_id !== req.user.id) {
      return res.status(403).json({ message: 'No puede asignar pacientes a otro docente.' });
    }

    const count = await query(`SELECT COUNT(*) as total FROM patients WHERE estudiante_id = ? AND estado = 'activo' AND strftime('%Y-%m', fecha_ingreso) = strftime('%Y-%m', ?)`, [estudiante_id, fecha_ingreso]);
    if (Number(count[0].total) >= 10) {
      return res.status(400).json({ message: 'El estudiante ya alcanzó el máximo de 10 pacientes activos por mes.' });
    }
  }

  const id = uuidv4();
  try {
    await run(`
      INSERT INTO patients (
        id, nombre, telefono, edad, foto_url, diagnostico, tipo_maloclusion,
        quirurgico, extracciones, notas, estudiante_id, semestre, fecha_ingreso, estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      nombre.trim(),
      telefono || '',
      edad || null,
      null,
      diagnostico || '',
      tipo_maloclusion || '',
      quirurgico ? 1 : 0,
      extracciones ? 1 : 0,
      notas || '',
      estudiante_id || null,
      Number(semestre),
      fecha_ingreso,
      estudiante_id ? 'activo' : 'sin_asignar'
    ]);
    await logAudit({
      userId: req.user.id,
      action: 'CREATE',
      entity: 'patients',
      entityId: id,
      newValue: { nombre: nombre.trim(), estudiante_id: estudiante_id || null, semestre: Number(semestre) }
    });

    return res.status(201).json({ message: 'Paciente registrado correctamente.', id });
  } catch (error) {
    return res.status(500).json({ message: 'Error al registrar paciente.', error: error.message });
  }
});

router.patch('/:id', requireAuth, requireRole('director', 'docente'), async (req, res) => {
  const { id } = req.params;
  const { nombre, telefono, edad, diagnostico, tipo_maloclusion, quirurgico, extracciones, notas, estudiante_id, semestre, estado } = req.body || {};

  try {
    const existing = await query('SELECT p.*, s.docente_id FROM patients p LEFT JOIN students s ON s.id = p.estudiante_id WHERE p.id = ?', [id]);
    if (!existing[0]) {
      return res.status(404).json({ message: 'Paciente no encontrado.' });
    }

    if (req.user.rol === 'docente' && existing[0].docente_id !== req.user.id) {
      return res.status(403).json({ message: 'No puede editar pacientes ajenos.' });
    }

    const nextEstudiante = estudiante_id ?? existing[0].estudiante_id;
    const nextEstado = estado ?? (nextEstudiante ? 'activo' : 'sin_asignar');

    await run(`
      UPDATE patients SET
        nombre = ?, telefono = ?, edad = ?, diagnostico = ?, tipo_maloclusion = ?,
        quirurgico = ?, extracciones = ?, notas = ?, estudiante_id = ?, semestre = ?,
        estado = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      nombre ? nombre.trim() : existing[0].nombre,
      telefono ?? existing[0].telefono,
      edad ?? existing[0].edad,
      diagnostico ?? existing[0].diagnostico,
      tipo_maloclusion ?? existing[0].tipo_maloclusion,
      quirurgico !== undefined ? (quirurgico ? 1 : 0) : existing[0].quirurgico,
      extracciones !== undefined ? (extracciones ? 1 : 0) : existing[0].extracciones,
      notas ?? existing[0].notas,
      nextEstudiante,
      semestre ?? existing[0].semestre,
      nextEstado,
      id
    ]);
    await logAudit({
      userId: req.user.id,
      action: 'UPDATE',
      entity: 'patients',
      entityId: id,
      oldValue: existing[0],
      newValue: { estudiante_id: nextEstudiante, semestre: semestre ?? existing[0].semestre, estado: nextEstado }
    });

    return res.json({ message: 'Paciente actualizado.' });
  } catch (error) {
    return res.status(500).json({ message: 'Error al actualizar paciente.', error: error.message });
  }
});

router.patch('/:id/reassign', requireAuth, requireRole('director', 'docente'), async (req, res) => {
  const { estudiante_id } = req.body || {};

  if (!estudiante_id) {
    return res.status(400).json({ message: 'Debe indicarse un estudiante para reasignar.' });
  }

  try {
    const patient = await query('SELECT p.*, s.docente_id FROM patients p LEFT JOIN students s ON s.id = p.estudiante_id WHERE p.id = ?', [req.params.id]);
    if (!patient[0]) {
      return res.status(404).json({ message: 'Paciente no encontrado.' });
    }

    const student = await query('SELECT * FROM students WHERE id = ?', [estudiante_id]);
    if (!student[0]) {
      return res.status(404).json({ message: 'Estudiante no encontrado.' });
    }

    if (req.user.rol === 'docente' && student[0].docente_id !== req.user.id) {
      return res.status(403).json({ message: 'No puede reasignar a un estudiante ajeno.' });
    }

    const count = await query(`SELECT COUNT(*) as total FROM patients WHERE estudiante_id = ? AND estado = 'activo' AND strftime('%Y-%m', fecha_ingreso) = strftime('%Y-%m', ?)`, [estudiante_id, patient[0].fecha_ingreso]);
    if (Number(count[0].total) >= 10) {
      return res.status(400).json({ message: 'El estudiante ya alcanzó el máximo de 10 pacientes activos.' });
    }

    await run(`UPDATE patients SET estudiante_id = ?, estado = 'activo', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [estudiante_id, req.params.id]);
    await logAudit({
      userId: req.user.id,
      action: 'REASSIGN',
      entity: 'patients',
      entityId: req.params.id,
      oldValue: patient[0],
      newValue: { estudiante_id, estado: 'activo' }
    });
    return res.json({ message: 'Paciente reasignado correctamente.' });
  } catch (error) {
    return res.status(500).json({ message: 'Error al reasignar paciente.', error: error.message });
  }
});

router.post('/:id/photo', requireAuth, requireRole('director', 'docente'), async (req, res) => {
  const { dataUrl } = req.body || {};
  if (!dataUrl || typeof dataUrl !== 'string') {
    return res.status(400).json({ message: 'Debe enviarse una imagen válida.' });
  }

  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) return res.status(400).json({ message: 'Solo se aceptan imágenes JPG, PNG o WEBP.' });

  const patient = await query(`SELECT p.*, s.docente_id FROM patients p LEFT JOIN students s ON s.id = p.estudiante_id WHERE p.id = ?`, [req.params.id]);
  if (!patient[0]) return res.status(404).json({ message: 'Paciente no encontrado.' });
  if (req.user.rol === 'docente' && patient[0].docente_id !== req.user.id) {
    return res.status(403).json({ message: 'No puede modificar pacientes ajenos.' });
  }

  const extension = match[1].split('/')[1].replace('jpeg', 'jpg');
  const filename = `${req.params.id}-${Date.now()}.${extension}`;
  const filePath = path.join(uploadsDirectory, filename);
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 5 * 1024 * 1024) return res.status(400).json({ message: 'La imagen no puede superar 5 MB.' });

  try {
    await fs.mkdir(uploadsDirectory, { recursive: true });
    await fs.writeFile(filePath, buffer);
    const photoUrl = `/uploads/${filename}`;
    await run('UPDATE patients SET foto_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [photoUrl, req.params.id]);
    await logAudit({ userId: req.user.id, action: 'UPLOAD_PHOTO', entity: 'patients', entityId: req.params.id, oldValue: { foto_url: patient[0].foto_url }, newValue: { foto_url: photoUrl } });
    return res.json({ message: 'Fotografía actualizada.', foto_url: photoUrl });
  } catch (error) {
    return res.status(500).json({ message: 'Error al guardar fotografía.', error: error.message });
  }
});

export default router;
