import express from 'express';
import ExcelJS from 'exceljs';
import puppeteer from 'puppeteer';
import { query } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

async function getStudentReport(req, studentId) {
  const student = await query(`
    SELECT s.*, u.nombre as docente_nombre
    FROM students s
    LEFT JOIN users u ON u.id = s.docente_id
    WHERE s.id = ?
  `, [studentId]);

  if (!student[0]) return { error: { status: 404, message: 'Estudiante no encontrado.' } };
  if (req.user.rol === 'docente' && student[0].docente_id !== req.user.id) {
    return { error: { status: 403, message: 'No puede consultar reportes de otro docente.' } };
  }

  const patients = await query(`SELECT * FROM patients WHERE estudiante_id = ? ORDER BY fecha_ingreso DESC`, [studentId]);
  const sessions = await query(`SELECT cs.*, p.nombre as paciente_nombre FROM clinical_sessions cs JOIN patients p ON p.id = cs.paciente_id WHERE cs.estudiante_id = ? ORDER BY cs.fecha DESC`, [studentId]);
  const rubricSummary = await query(`SELECT r.semestre, r.nombre, r.peso_meta, e.valor, e.porcentaje FROM rubrics r LEFT JOIN rubric_evaluations e ON e.rubric_id = r.id AND e.estudiante_id = ? WHERE r.activo = true ORDER BY r.semestre, r.nombre`, [studentId]);
  const progressBySemester = await query(`
    SELECT r.semestre, COUNT(r.id) as total_rubricas,
      COUNT(e.id) as evaluadas,
      COALESCE(ROUND(AVG(e.porcentaje), 2), 0) as porcentaje
    FROM rubrics r
    LEFT JOIN rubric_evaluations e ON e.rubric_id = r.id AND e.estudiante_id = ?
    WHERE r.activo = true
    GROUP BY r.semestre
    ORDER BY r.semestre
  `, [studentId]);

  return {
    report: {
      student: student[0],
      patients,
      sessions,
      rubricSummary,
      progressBySemester
    }
  };
}

router.get('/student/:studentId', requireAuth, requireRole('director', 'docente'), async (req, res) => {
  try {
    const result = await getStudentReport(req, req.params.studentId);
    if (result.error) return res.status(result.error.status).json({ message: result.error.message });
    return res.json(result.report);
  } catch (error) {
    return res.status(500).json({ message: 'Error al generar reporte.', error: error.message });
  }
});

router.get('/student/:studentId/export.csv', requireAuth, requireRole('director', 'docente'), async (req, res) => {
  try {
    const result = await getStudentReport(req, req.params.studentId);
    if (result.error) return res.status(result.error.status).json({ message: result.error.message });

    const { student, sessions, rubricSummary, progressBySemester } = result.report;
    const rows = [
      ['REPORTE DE ESTUDIANTE', student.nombre],
      ['Docente', student.docente_nombre || ''],
      ['Semestre actual', student.semestre_actual],
      [],
      ['PROGRESO POR SEMESTRE'],
      ['Semestre', 'Rúbricas', 'Evaluadas', 'Porcentaje'],
      ...progressBySemester.map((item) => [item.semestre, item.total_rubricas, item.evaluadas, item.porcentaje]),
      [],
      ['EVALUACIONES'],
      ['Semestre', 'Rúbrica', 'Meta', 'Valor', 'Porcentaje'],
      ...rubricSummary.map((item) => [item.semestre, item.nombre, item.peso_meta, item.valor ?? '', item.porcentaje ?? '']),
      [],
      ['ATENCIONES'],
      ['Fecha', 'Paciente', 'Procedimiento', 'Semestre', 'Observaciones'],
      ...sessions.map((item) => [item.fecha, item.paciente_nombre, item.procedimiento, item.semestre, item.observaciones])
    ];

    const csv = `\ufeff${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-${student.id}.csv"`);
    return res.send(csv);
  } catch (error) {
    return res.status(500).json({ message: 'Error al exportar reporte.', error: error.message });
  }
});

router.get('/student/:studentId/print', requireAuth, requireRole('director', 'docente'), async (req, res) => {
  try {
    const result = await getStudentReport(req, req.params.studentId);
    if (result.error) return res.status(result.error.status).json({ message: result.error.message });
    const { student, patients, sessions, rubricSummary, progressBySemester } = result.report;
    const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    const rows = sessions.map((item) => `<tr><td>${escapeHtml(item.fecha)}</td><td>${escapeHtml(item.paciente_nombre)}</td><td>${escapeHtml(item.procedimiento)}</td><td>${escapeHtml(item.semestre)}</td><td>${escapeHtml(item.observaciones)}</td></tr>`).join('');
    const rubrics = rubricSummary.map((item) => `<tr><td>${escapeHtml(item.semestre)}</td><td>${escapeHtml(item.nombre)}</td><td>${escapeHtml(item.peso_meta)}</td><td>${escapeHtml(item.porcentaje ?? 'Pendiente')}</td></tr>`).join('');
    const progress = progressBySemester.map((item) => `<div class="progress-row"><span>Semestre ${item.semestre}</span><b>${item.porcentaje}%</b><div><i style="width:${Math.min(Number(item.porcentaje), 100)}%"></i></div></div>`).join('');
    return res.send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reporte ${escapeHtml(student.nombre)}</title><style>body{font-family:Arial,sans-serif;color:#25262b;margin:40px}header{border-bottom:4px solid #a51c30;padding-bottom:18px;margin-bottom:24px}h1{margin:0;color:#741526}h2{font-size:16px;border-bottom:1px solid #ddd;padding-bottom:8px;margin-top:30px}p{color:#666}table{width:100%;border-collapse:collapse;font-size:12px}th,td{text-align:left;padding:9px;border-bottom:1px solid #ddd}th{color:#741526}.progress-row{margin:12px 0;font-size:12px}.progress-row b{float:right}.progress-row div{clear:both;height:8px;background:#f3dfe3;margin-top:6px}.progress-row i{display:block;height:100%;background:#a51c30}@media print{body{margin:20px}}</style></head><body><header><p>UNIVERSIDAD DEL VALLE · POSGRADO DE ORTODONCIA</p><h1>Reporte clínico-académico</h1><p><b>Estudiante:</b> ${escapeHtml(student.nombre)} · <b>Docente:</b> ${escapeHtml(student.docente_nombre)} · <b>Semestre:</b> ${escapeHtml(student.semestre_actual)}</p></header><h2>Progreso por semestre</h2>${progress || '<p>Sin evaluaciones registradas.</p>'}<h2>Pacientes (${patients.length})</h2><table><thead><tr><th>Paciente</th><th>Diagnóstico</th><th>Semestre</th><th>Estado</th></tr></thead><tbody>${patients.map((item) => `<tr><td>${escapeHtml(item.nombre)}</td><td>${escapeHtml(item.diagnostico)}</td><td>${escapeHtml(item.semestre)}</td><td>${escapeHtml(item.estado)}</td></tr>`).join('')}</tbody></table><h2>Rúbricas</h2><table><thead><tr><th>Semestre</th><th>Criterio</th><th>Meta</th><th>Cumplimiento</th></tr></thead><tbody>${rubrics}</tbody></table><h2>Atenciones (${sessions.length})</h2><table><thead><tr><th>Fecha</th><th>Paciente</th><th>Procedimiento</th><th>Semestre</th><th>Observaciones</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
  } catch (error) {
    return res.status(500).json({ message: 'Error al preparar reporte imprimible.', error: error.message });
  }
});

router.get('/student/:studentId/export.xlsx', requireAuth, requireRole('director', 'docente'), async (req, res) => {
  try {
    const result = await getStudentReport(req, req.params.studentId);
    if (result.error) return res.status(result.error.status).json({ message: result.error.message });
    const { student, patients, sessions, rubricSummary, progressBySemester } = result.report;
    const workbook = new ExcelJS.Workbook();
    const addSheet = (name, columns, rows) => {
      const sheet = workbook.addWorksheet(name);
      sheet.columns = columns.map((header) => ({ header, key: header, width: 22 }));
      sheet.addRows(rows);
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA51C30' } };
    };
    addSheet('Resumen', ['Estudiante', 'Docente', 'Semestre', 'Atenciones', 'Pacientes'], [{ Estudiante: student.nombre, Docente: student.docente_nombre || '', Semestre: student.semestre_actual, Atenciones: sessions.length, Pacientes: patients.length }]);
    addSheet('Pacientes', ['Nombre', 'Diagnostico', 'Semestre', 'Estado'], patients.map((item) => ({ Nombre: item.nombre, Diagnostico: item.diagnostico, Semestre: item.semestre, Estado: item.estado })));
    addSheet('Atenciones', ['Fecha', 'Paciente', 'Procedimiento', 'Semestre', 'Observaciones'], sessions.map((item) => ({ Fecha: item.fecha, Paciente: item.paciente_nombre, Procedimiento: item.procedimiento, Semestre: item.semestre, Observaciones: item.observaciones })));
    addSheet('Rubricas', ['Semestre', 'Criterio', 'Meta', 'Valor', 'Porcentaje'], rubricSummary.map((item) => ({ Semestre: item.semestre, Criterio: item.nombre, Meta: item.peso_meta, Valor: item.valor ?? '', Porcentaje: item.porcentaje ?? '' })));
    addSheet('Progreso', ['Semestre', 'Total Rubricas', 'Evaluadas', 'Porcentaje'], progressBySemester.map((item) => ({ Semestre: item.semestre, 'Total Rubricas': item.total_rubricas, Evaluadas: item.evaluadas, Porcentaje: item.porcentaje })));
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-${student.id}.xlsx"`);
    return res.send(buffer);
  } catch (error) {
    return res.status(500).json({ message: 'Error al exportar XLSX.', error: error.message });
  }
});

router.get('/student/:studentId/export.pdf', requireAuth, requireRole('director', 'docente'), async (req, res) => {
  let browser;
  try {
    const result = await getStudentReport(req, req.params.studentId);
    if (result.error) return res.status(result.error.status).json({ message: result.error.message });
    const { student, patients, sessions, rubricSummary } = result.report;
    const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    const html = `<html><head><meta charset="utf-8"><style>body{font-family:Arial;color:#24262b;margin:36px}h1{color:#741526;border-bottom:3px solid #a51c30;padding-bottom:12px}h2{color:#741526;margin-top:28px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{text-align:left;padding:8px;border-bottom:1px solid #ddd}th{color:#741526}</style></head><body><p>UNIVERSIDAD DEL VALLE · POSGRADO DE ORTODONCIA</p><h1>Reporte clínico-académico</h1><p><b>Estudiante:</b> ${escapeHtml(student.nombre)}<br><b>Docente:</b> ${escapeHtml(student.docente_nombre)}<br><b>Semestre:</b> ${escapeHtml(student.semestre_actual)}</p><h2>Pacientes (${patients.length})</h2><table><tr><th>Nombre</th><th>Diagnóstico</th><th>Semestre</th><th>Estado</th></tr>${patients.map((item) => `<tr><td>${escapeHtml(item.nombre)}</td><td>${escapeHtml(item.diagnostico)}</td><td>${escapeHtml(item.semestre)}</td><td>${escapeHtml(item.estado)}</td></tr>`).join('')}</table><h2>Rúbricas</h2><table><tr><th>Semestre</th><th>Criterio</th><th>Meta</th><th>Porcentaje</th></tr>${rubricSummary.map((item) => `<tr><td>${escapeHtml(item.semestre)}</td><td>${escapeHtml(item.nombre)}</td><td>${escapeHtml(item.peso_meta)}</td><td>${escapeHtml(item.porcentaje ?? 'Pendiente')}</td></tr>`).join('')}</table><h2>Atenciones (${sessions.length})</h2><table><tr><th>Fecha</th><th>Paciente</th><th>Procedimiento</th><th>Semestre</th></tr>${sessions.map((item) => `<tr><td>${escapeHtml(item.fecha)}</td><td>${escapeHtml(item.paciente_nombre)}</td><td>${escapeHtml(item.procedimiento)}</td><td>${escapeHtml(item.semestre)}</td></tr>`).join('')}</table></body></html>`;
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '18mm', right: '14mm', bottom: '18mm', left: '14mm' } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-${student.id}.pdf"`);
    return res.send(pdf);
  } catch (error) {
    return res.status(500).json({ message: 'Error al generar PDF. Verifique Chromium de Puppeteer.', error: error.message });
  } finally {
    if (browser) await browser.close();
  }
});

export default router;
