export default function PatientDetailPanel({ patient, sessions, students, onReassign, onUploadPhoto }) {
  if (!patient) return <div className="panel-card">Seleccione un paciente.</div>;

  return (
    <div className="panel-card detail-card">
      <div className="patient-heading">
        {patient.foto_url ? <img className="patient-photo" src={patient.foto_url.startsWith('http') ? patient.foto_url : `${(import.meta.env.VITE_API_URL || 'http://localhost:4001/api').replace('/api', '')}${patient.foto_url}`} alt={`Paciente ${patient.nombre}`} /> : <div className="patient-photo patient-photo-empty">{patient.nombre.slice(0, 1)}</div>}
        <div><h3>Ficha clínica</h3><p className="patient-heading-meta">{patient.nombre} · {patient.estado}</p></div>
        <label className="photo-upload secondary-btn">Cambiar foto<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => onUploadPhoto(patient.id, event.target.files?.[0])} /></label>
      </div>
      <div className="detail-grid">
        <div>
          <p><strong>Nombre:</strong> {patient.nombre}</p>
          <p><strong>Edad:</strong> {patient.edad}</p>
          <p><strong>Teléfono:</strong> {patient.telefono}</p>
          <p><strong>Diagnóstico:</strong> {patient.diagnostico}</p>
        </div>
        <div>
          <p><strong>Maloclusión:</strong> {patient.tipo_maloclusion}</p>
          <p><strong>Cirugía:</strong> {patient.quirurgico ? 'Sí' : 'No'}</p>
          <p><strong>Extracciones:</strong> {patient.extracciones ? 'Sí' : 'No'}</p>
          <p><strong>Semestre:</strong> {patient.semestre}</p>
        </div>
      </div>

      <div className="detail-actions">
        <label>
          Reasignar a estudiante
          <select defaultValue="" onChange={(e) => onReassign(patient.id, e.target.value)}>
            <option value="">Seleccione</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>{student.nombre}</option>
            ))}
          </select>
        </label>
      </div>

      <h4>Historial clínico</h4>
      <ul className="timeline-list">
        {(sessions || []).map((session) => (
          <li key={session.id}>
            <strong>{session.fecha}</strong> — {session.procedimiento}
            <div>{session.observaciones}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
