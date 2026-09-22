import express from 'express';
import { query } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, requireRole('director', 'docente'), async (req, res) => {
  try {
    const isDirector = req.user.rol === 'director';
    const teacherScope = isDirector ? '' : 'WHERE s.docente_id = ?';
    const teacherParams = isDirector ? [] : [req.user.id];

    const teachers = await query(`SELECT COUNT(*) as total FROM users WHERE rol = 'docente'`);
    const students = await query(`SELECT COUNT(*) as total FROM students ${teacherScope}`, teacherParams);
    const patients = await query(`SELECT COUNT(*) as total FROM patients p LEFT JOIN students s ON s.id = p.estudiante_id ${teacherScope}`, teacherParams);
    const sessions = await query(`SELECT COUNT(*) as total FROM clinical_sessions cs JOIN students s ON s.id = cs.estudiante_id ${teacherScope}`, teacherParams);
    const patientScope = isDirector ? '' : 'WHERE s.docente_id = ?';
    const patientParams = isDirector ? [] : [req.user.id];
    const surgical = await query(`SELECT COUNT(*) as total FROM patients p LEFT JOIN students s ON s.id = p.estudiante_id ${patientScope}${patientScope ? ' AND' : ' WHERE'} p.quirurgico = true`, patientParams);
    const extractions = await query(`SELECT COUNT(*) as total FROM patients p LEFT JOIN students s ON s.id = p.estudiante_id ${patientScope}${patientScope ? ' AND' : ' WHERE'} p.extracciones = true`, patientParams);
    const unassigned = await query(`SELECT COUNT(*) as total FROM patients p LEFT JOIN students s ON s.id = p.estudiante_id ${patientScope}${patientScope ? ' AND' : ' WHERE'} p.estado = 'sin_asignar'`, patientParams);

    const bySemestre = await query(`SELECT s.semestre_actual AS semestre, COUNT(*) as total FROM students s ${teacherScope} GROUP BY s.semestre_actual ORDER BY semestre`, teacherParams);
    const byTeacher = isDirector
      ? await query(`SELECT u.nombre, COUNT(s.id) as total FROM students s JOIN users u ON u.id = s.docente_id GROUP BY u.id, u.nombre ORDER BY total DESC`)
      : await query(`SELECT u.nombre, COUNT(s.id) as total FROM students s JOIN users u ON u.id = s.docente_id WHERE u.id = ? GROUP BY u.id, u.nombre ORDER BY total DESC`, [req.user.id]);

    const studentStateScope = isDirector ? 'WHERE s.estado = ?' : 'WHERE s.docente_id = ? AND s.estado = ?';
    const studentsActive = await query(`SELECT COUNT(*) as total FROM students s ${studentStateScope}`, isDirector ? ['activo'] : [req.user.id, 'activo']);
    const studentsRetired = await query(`SELECT COUNT(*) as total FROM students s ${studentStateScope}`, isDirector ? ['retirado'] : [req.user.id, 'retirado']);

    const progressByStudent = await query(`
      SELECT s.id, s.nombre, s.semestre_actual, s.estado,
        COUNT(DISTINCT CASE WHEN p.estado = 'activo' THEN p.id END) AS pacientes_activos,
        COUNT(DISTINCT cs.id) AS atenciones,
        COALESCE(ROUND(AVG(re.porcentaje), 2), 0) AS progreso_rubricas
      FROM students s
      LEFT JOIN patients p ON p.estudiante_id = s.id
      LEFT JOIN clinical_sessions cs ON cs.estudiante_id = s.id
      LEFT JOIN rubric_evaluations re ON re.estudiante_id = s.id
      ${teacherScope}
      GROUP BY s.id, s.nombre, s.semestre_actual, s.estado
      ORDER BY s.nombre
    `, teacherParams);

    const summary = {
      totalDocentes: isDirector ? Number(teachers[0]?.total || 0) : 1,
      totalEstudiantes: Number(students[0]?.total || 0),
      totalPacientes: Number(patients[0]?.total || 0),
      totalAtenciones: Number(sessions[0]?.total || 0),
      casosQuirurgicos: Number(surgical[0]?.total || 0),
      casosExtracciones: Number(extractions[0]?.total || 0),
      pacientesSinAsignar: Number(unassigned[0]?.total || 0),
      estudiantesActivos: Number(studentsActive[0]?.total || 0),
      estudiantesRetirados: Number(studentsRetired[0]?.total || 0),
      progresoPorSemestre: bySemestre,
      distribucionPorDocente: byTeacher,
      progresoPorEstudiante: progressByStudent
    };

    return res.json(summary);
  } catch (error) {
    return res.status(500).json({ message: 'Error al cargar dashboard.', error: error.message });
  }
});

export default router;
