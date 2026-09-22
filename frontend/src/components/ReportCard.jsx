export default function ReportCard({ student, report, onExport, onExportXlsx, onExportPdf, onPrint }) {
  if (!student || !report) return <div className="panel-card">Seleccione un estudiante para ver el reporte.</div>;

  const sessions = report.sessions || [];
  const rubricSummary = report.rubricSummary || [];
  const totalSessions = sessions.length;
  const avgRubric = rubricSummary.length
    ? Math.round(rubricSummary.reduce((sum, item) => sum + Number(item.porcentaje || 0), 0) / rubricSummary.length)
    : 0;

  return (
    <div className="panel-card">
      <h3>Reporte semestral</h3>
      <div className="report-grid">
        <div><strong>Estudiante:</strong> {student.nombre}</div>
        <div><strong>Semestre:</strong> {student.semestre_actual}</div>
        <div><strong>Docente:</strong> {student.docente_nombre || 'Sin docente'}</div>
        <div><strong>Atenciones:</strong> {totalSessions}</div>
        <div><strong>Cumplimiento:</strong> {avgRubric}%</div>
      </div>

      <div className="report-actions">
        <button className="primary-btn small-btn" onClick={onExport}>Descargar CSV</button>
        <button className="secondary-btn small-btn" onClick={onExportXlsx}>Descargar Excel</button>
        <button className="secondary-btn small-btn" onClick={onExportPdf}>Descargar PDF</button>
        <button className="secondary-btn small-btn" onClick={onPrint}>Generar PDF / imprimir</button>
      </div>

      <h4>Progreso por semestre</h4>
      <ul className="mini-list">
        {(report.progressBySemester || []).map((item) => (
          <li key={item.semestre}>
            <span>Semestre {item.semestre}: {item.evaluadas}/{item.total_rubricas} evaluadas</span>
            <strong>{item.porcentaje}%</strong>
          </li>
        ))}
      </ul>

      <div className="rubric-list">
        {(rubricSummary || []).map((item) => (
          <div key={item.nombre} className="rubric-item">
            <div className="rubric-head">
              <strong>{item.nombre}</strong>
              <span>{item.porcentaje ?? 0}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
