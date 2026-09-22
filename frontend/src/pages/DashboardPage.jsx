import { useEffect, useMemo, useState } from 'react';
import PatientDetailPanel from '../components/PatientDetailPanel.jsx';
import RubricPanel from '../components/RubricPanel.jsx';
import ReportCard from '../components/ReportCard.jsx';
import UniversityBrand from '../components/UniversityBrand.jsx';
import UiIcon from '../components/UiIcon.jsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const defaultStudentForm = {
  nombre: '',
  semestre_actual: '1',
  docente_id: ''
};

const defaultPatientForm = {
  nombre: '',
  telefono: '',
  edad: '',
  diagnostico: '',
  tipo_maloclusion: '',
  quirurgico: false,
  extracciones: false,
  notas: '',
  estudiante_id: '',
  semestre: '1',
  fecha_ingreso: new Date().toISOString().slice(0, 10)
};

const defaultSessionForm = {
  paciente_id: '',
  estudiante_id: '',
  fecha: new Date().toISOString().slice(0, 10),
  procedimiento: '',
  observaciones: '',
  semestre: '1'
};

const defaultRubricForm = {
  semestre: '1',
  nombre: '',
  descripcion: '',
  peso_meta: '10'
};

const defaultTeacherForm = {
  nombre: '',
  email: '',
  password: ''
};

export default function DashboardPage({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [patients, setPatients] = useState([]);
  const [unassignedPatients, setUnassignedPatients] = useState([]);
  const [rubrics, setRubrics] = useState([]);
  const [studentRubrics, setStudentRubrics] = useState([]);
  const [studentReport, setStudentReport] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [selectedPatientDetail, setSelectedPatientDetail] = useState(null);
  const [selectedPatientSessions, setSelectedPatientSessions] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [studentForm, setStudentForm] = useState(defaultStudentForm);
  const [patientForm, setPatientForm] = useState(defaultPatientForm);
  const [sessionForm, setSessionForm] = useState(defaultSessionForm);
  const [rubricForm, setRubricForm] = useState(defaultRubricForm);
  const [teacherForm, setTeacherForm] = useState(defaultTeacherForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [patientStatusFilter, setPatientStatusFilter] = useState('all');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [editingStudent, setEditingStudent] = useState(null);
  const [editingPatient, setEditingPatient] = useState(null);

  const token = localStorage.getItem('uv_token');
  const filteredStudents = students.filter((student) => `${student.nombre} ${student.docente_nombre || ''}`.toLowerCase().includes(studentSearch.toLowerCase()) && (semesterFilter === 'all' || String(student.semestre_actual) === semesterFilter));
  const filteredPatients = patients.filter((patient) => patient.nombre.toLowerCase().includes(patientSearch.toLowerCase()) && (patientStatusFilter === 'all' || patient.estado === patientStatusFilter) && (semesterFilter === 'all' || String(patient.semestre) === semesterFilter));

  const loadStudentRubrics = async (studentId) => {
    if (!studentId) {
      setStudentRubrics([]);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/rubrics/student/${studentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'No se pudieron cargar las rúbricas.');
      setStudentRubrics(data || []);
    } catch (err) {
      setStudentRubrics([]);
      setError(err.message);
    }
  };

  const loadStudentReport = async (studentId) => {
    if (!studentId) {
      setStudentReport(null);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/reports/student/${studentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'No se pudo generar el reporte.');
      setStudentReport(data);
    } catch (err) {
      setStudentReport(null);
      setError(err.message);
    }
  };

  const loadData = async () => {
    try {
      const [dashboardRes, teachersRes, studentsRes, patientsRes, sessionsRes, unassignedRes, rubricsRes, auditRes] = await Promise.all([
        fetch(`${API_URL}/dashboard`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/students`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/patients`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/clinical-sessions`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/patients/unassigned`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/rubrics`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/audit`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const dashboardData = await dashboardRes.json();
      const teachersData = await teachersRes.json();
      const studentsData = await studentsRes.json();
      const patientsData = await patientsRes.json();
      const sessionsData = await sessionsRes.json();
      const unassignedData = await unassignedRes.json();
      const rubricsData = await rubricsRes.json();
      const auditData = await auditRes.json();

      if (!dashboardRes.ok || !teachersRes.ok || !studentsRes.ok || !patientsRes.ok || !sessionsRes.ok || !unassignedRes.ok || !rubricsRes.ok || !auditRes.ok) {
        throw new Error(dashboardData.message || 'Error al cargar información.');
      }

      setDashboard(dashboardData);
      setTeachers(teachersData);
      setStudents(studentsData);
      setPatients(patientsData);
      setSessions(sessionsData);
      setUnassignedPatients(unassignedData);
      setRubrics(rubricsData);
      setAuditLogs(auditData);

      if (!selectedStudentId && studentsData.length > 0) {
        setSelectedStudentId(studentsData[0].id);
      }
    } catch (err) {
      setError(err.message || 'Error al cargar el dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedStudentId) {
      loadStudentRubrics(selectedStudentId);
      loadStudentReport(selectedStudentId);
    }
  }, [selectedStudentId]);

  const roleLabel = useMemo(() => {
    if (!user) return 'Sin rol';
    return user.rol === 'director' ? 'Director de Clínica' : 'Docente de Clínica';
  }, [user]);

  const navSections = [
    { label: 'PRINCIPAL', items: [{ id: 'dashboard', label: 'Dashboard', icon: 'dashboard' }] },
    { label: 'GESTIÓN CLÍNICA', items: [
      { id: 'students', label: 'Estudiantes', icon: 'students' },
      { id: 'patients', label: 'Pacientes', icon: 'patients' },
      { id: 'sessions', label: 'Atenciones', icon: 'sessions' }
    ] },
    { label: 'EVALUACIÓN', items: [
      { id: 'rubrics', label: 'Rúbricas', icon: 'rubrics' },
      { id: 'reports', label: 'Progreso y reportes', icon: 'reports' }
    ] }
  ];

  const handleCreateStudent = async (event) => {
    event.preventDefault();
    try {
      const response = await fetch(`${API_URL}/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          nombre: studentForm.nombre,
          semestre_actual: Number(studentForm.semestre_actual),
          docente_id: user.rol === 'director' ? studentForm.docente_id || user.id : user.id
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'No se pudo crear al estudiante.');
      setStudentForm(defaultStudentForm);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRetireStudent = async (studentId) => {
    const confirmed = window.confirm('¿Está seguro de retirar a este estudiante? Sus pacientes pasarán a estado Sin asignar y podrán ser reasignados posteriormente.');
    if (!confirmed) return;

    try {
      const response = await fetch(`${API_URL}/students/${studentId}/retire`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'No se pudo retirar al estudiante.');
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReassignPatient = async (patientId, newStudentId) => {
    if (!newStudentId) return;
    try {
      const response = await fetch(`${API_URL}/patients/${patientId}/reassign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ estudiante_id: newStudentId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'No se pudo reasignar el paciente.');
      await loadData();
      if (selectedPatientId === patientId) {
        const updatedDetail = await fetch(`${API_URL}/patients/${patientId}`, { headers: { Authorization: `Bearer ${token}` } });
        const detailData = await updatedDetail.json();
        setSelectedPatientDetail(detailData.patient);
        setSelectedPatientSessions(detailData.sessions || []);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEvaluateRubric = async (studentId, rubricId, value) => {
    try {
      const response = await fetch(`${API_URL}/rubrics/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          estudiante_id: studentId,
          rubric_id: rubricId,
          valor: value,
          porcentaje: value
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'No se pudo evaluar la rúbrica.');
      await loadData();
      await loadStudentRubrics(studentId);
      await loadStudentReport(studentId);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateRubric = async (event) => {
    event.preventDefault();
    try {
      const response = await fetch(`${API_URL}/rubrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          semestre: Number(rubricForm.semestre),
          nombre: rubricForm.nombre,
          descripcion: rubricForm.descripcion,
          peso_meta: Number(rubricForm.peso_meta)
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'No se pudo crear la rúbrica.');
      setRubricForm(defaultRubricForm);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateTeacher = async (event) => {
    event.preventDefault();
    try {
      const response = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(teacherForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'No se pudo crear el docente.');
      setTeacherForm(defaultTeacherForm);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleExportReport = async () => {
    if (!selectedStudentId) return;

    try {
      const response = await fetch(`${API_URL}/reports/student/${selectedStudentId}/export.csv`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'No se pudo exportar el reporte.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reporte-${selectedStudentId}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePrintReport = async () => {
    if (!selectedStudentId) return;
    try {
      const response = await fetch(`${API_URL}/reports/student/${selectedStudentId}/print`, { headers: { Authorization: `Bearer ${token}` } });
      const html = await response.text();
      if (!response.ok) throw new Error('No se pudo generar el reporte imprimible.');
      const reportWindow = window.open('', '_blank', 'noopener,noreferrer');
      if (!reportWindow) throw new Error('El navegador bloqueó la ventana del reporte.');
      reportWindow.document.write(html);
      reportWindow.document.close();
    } catch (err) { setError(err.message); }
  };

  const downloadReportFile = async (extension, mime) => {
    if (!selectedStudentId) return;
    try {
      const response = await fetch(`${API_URL}/reports/student/${selectedStudentId}/export.${extension}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(`No se pudo exportar el reporte ${extension.toUpperCase()}.`);
      const blob = await response.blob();
      const url = URL.createObjectURL(new Blob([blob], { type: mime }));
      const link = document.createElement('a'); link.href = url; link.download = `reporte-${selectedStudentId}.${extension}`; link.click(); URL.revokeObjectURL(url);
    } catch (err) { setError(err.message); }
  };

  const handleUploadPhoto = async (patientId, file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setError('La imagen no puede superar 5 MB.');
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const response = await fetch(`${API_URL}/patients/${patientId}/photo`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ dataUrl: reader.result }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'No se pudo subir la fotografía.');
        await loadData();
        await openPatientDetail(patientId);
      } catch (err) { setError(err.message); }
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateStudent = async (event) => {
    event.preventDefault();
    try {
      const response = await fetch(`${API_URL}/students/${editingStudent.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(editingStudent) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'No se pudo actualizar el estudiante.');
      setEditingStudent(null); await loadData();
    } catch (err) { setError(err.message); }
  };

  const handleUpdatePatient = async (event) => {
    event.preventDefault();
    try {
      const response = await fetch(`${API_URL}/patients/${editingPatient.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(editingPatient) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'No se pudo actualizar el paciente.');
      setEditingPatient(null); await loadData();
    } catch (err) { setError(err.message); }
  };

  const openPatientDetail = async (patientId) => {
    setSelectedPatientId(patientId);
    const response = await fetch(`${API_URL}/patients/${patientId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    setSelectedPatientDetail(data.patient);
    setSelectedPatientSessions(data.sessions || []);
  };

  const handleCreatePatient = async (event) => {
    event.preventDefault();
    try {
      const response = await fetch(`${API_URL}/patients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          nombre: patientForm.nombre,
          telefono: patientForm.telefono,
          edad: patientForm.edad ? Number(patientForm.edad) : null,
          diagnostico: patientForm.diagnostico,
          tipo_maloclusion: patientForm.tipo_maloclusion,
          quirurgico: patientForm.quirurgico,
          extracciones: patientForm.extracciones,
          notas: patientForm.notas,
          estudiante_id: patientForm.estudiante_id || null,
          semestre: Number(patientForm.semestre),
          fecha_ingreso: patientForm.fecha_ingreso
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'No se pudo crear el paciente.');
      setPatientForm(defaultPatientForm);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateSession = async (event) => {
    event.preventDefault();
    try {
      const response = await fetch(`${API_URL}/clinical-sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          paciente_id: sessionForm.paciente_id,
          estudiante_id: sessionForm.estudiante_id,
          fecha: sessionForm.fecha,
          procedimiento: sessionForm.procedimiento,
          observaciones: sessionForm.observaciones,
          semestre: Number(sessionForm.semestre)
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'No se pudo registrar la atención.');
      setSessionForm(defaultSessionForm);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="app-loading">Cargando dashboard...</div>;
  }

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <UniversityBrand compact={false} inverse />
        <nav className="sidebar-nav">
          {navSections.map((section) => (
            <div className="nav-section" key={section.label}>
              <span className="nav-section-label">{section.label}</span>
              {section.items.map((item) => (
                <button key={item.id} className={`nav-item ${activeTab === item.id ? 'active' : ''}`} onClick={() => setActiveTab(item.id)}>
                  <UiIcon name={item.icon} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="user-card">
          <div className="user-avatar">{user?.nombre?.slice(0, 1) || 'U'}</div>
          <div className="user-card-copy"><div className="user-name">{user?.nombre}</div><div className="user-role">{roleLabel}</div></div>
          <button className="logout-btn" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión"><UiIcon name="logout" /></button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <span className="breadcrumb">Sistema de Gestión Clínica <span>/</span> {activeTab === 'dashboard' ? 'Dashboard' : activeTab}</span>
            <h2>{activeTab === 'dashboard' ? `Buenos días, ${user?.nombre?.split(' ')[0] || 'equipo'}` : navSections.flatMap((section) => section.items).find((item) => item.id === activeTab)?.label}</h2>
            <p>{activeTab === 'dashboard' ? 'Resumen del estado clínico y académico del programa.' : 'Información operativa del Posgrado de Ortodoncia.'}</p>
          </div>
          <div className="topbar-actions">
            <button className="icon-btn" aria-label="Notificaciones" title="Notificaciones"><UiIcon name="bell" /></button>
            <div className="profile-chip"><div className="user-avatar">{user?.nombre?.slice(0, 1) || 'U'}</div><div><strong>{user?.nombre}</strong><span>{roleLabel}</span></div></div>
          </div>
        </header>

        {error && (
          <div className="error-box dashboard-error">
            {error}
            <button className="secondary-btn small-btn" onClick={() => setError('')}>Cerrar</button>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <>
            <section className="kpis-grid">
              <div className="kpi-card"><span>Docentes</span><strong>{dashboard?.totalDocentes ?? 0}</strong></div>
              <div className="kpi-card"><span>Estudiantes</span><strong>{dashboard?.totalEstudiantes ?? 0}</strong></div>
              <div className="kpi-card"><span>Pacientes</span><strong>{dashboard?.totalPacientes ?? 0}</strong></div>
              <div className="kpi-card"><span>Atenciones</span><strong>{dashboard?.totalAtenciones ?? 0}</strong></div>
              <div className="kpi-card"><span>Casos quirúrgicos</span><strong>{dashboard?.casosQuirurgicos ?? 0}</strong></div>
              <div className="kpi-card"><span>Extracciones</span><strong>{dashboard?.casosExtracciones ?? 0}</strong></div>
            </section>

            <section className="content-grid">
              <div className="panel-card">
                <h3>Progreso por semestre</h3>
                {(dashboard?.progresoPorSemestre || []).length === 0 ? <div className="empty-state">No hay progreso registrado.</div> : <div className="bar-chart">{dashboard.progresoPorSemestre.map((item) => <div className="bar-item" key={item.semestre}><div className="bar-track"><i style={{ height: `${Math.min(item.total * 12, 100)}%` }} /></div><strong>{item.total}</strong><span>S{item.semestre}</span></div>)}</div>}
              </div>

              <div className="panel-card">
                <h3>Distribución por docente</h3>
                {(dashboard?.distribucionPorDocente || []).length === 0 ? <div className="empty-state">No hay docentes registrados.</div> : <ul className="mini-list">{dashboard.distribucionPorDocente.map((item) => <li key={item.nombre}><span>{item.nombre}</span><strong>{item.total}</strong></li>)}</ul>}
              </div>
            </section>

            <section className="content-grid">
              <div className="panel-card">
                <h3>Auditoría</h3>
                <ul className="mini-list">
                  {(auditLogs || []).slice(0, 6).map((log) => (
                    <li key={log.id}><span>{log.action}</span><strong>{log.entity}</strong></li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="panel-card table-card">
              <h3>Progreso por estudiante</h3>
              <table>
                <thead>
                  <tr>
                    <th>Estudiante</th>
                    <th>Semestre</th>
                    <th>Pacientes</th>
                    <th>Atenciones</th>
                    <th>Rúbricas</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {(dashboard?.progresoPorEstudiante || []).map((student) => (
                    <tr key={student.id}>
                      <td>{student.nombre}</td>
                      <td>{student.semestre_actual}</td>
                      <td>{student.pacientes_activos} / 10</td>
                      <td>{student.atenciones}</td>
                      <td>{student.progreso_rubricas}%</td>
                      <td><span className={`badge ${student.estado}`}>{student.estado}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}

        {activeTab === 'students' && (
          <div className="module-grid">
            {user.rol === 'director' && (
              <div className="panel-card form-card">
                <h3>Crear docente</h3>
                <form onSubmit={handleCreateTeacher} className="stack-form">
                  <input
                    value={teacherForm.nombre}
                    onChange={(e) => setTeacherForm({ ...teacherForm, nombre: e.target.value })}
                    placeholder="Nombre completo"
                  />
                  <input
                    type="email"
                    value={teacherForm.email}
                    onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                    placeholder="Correo institucional"
                  />
                  <input
                    type="password"
                    value={teacherForm.password}
                    onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
                    placeholder="Contraseña mínima de 8 caracteres"
                  />
                  <button type="submit" className="primary-btn">Guardar docente</button>
                </form>
              </div>
            )}

            <div className="panel-card form-card">
              <h3>Crear estudiante</h3>
              <form onSubmit={handleCreateStudent} className="stack-form">
                <input
                  value={studentForm.nombre}
                  onChange={(e) => setStudentForm({ ...studentForm, nombre: e.target.value })}
                  placeholder="Nombre completo"
                />
                <select
                  value={studentForm.semestre_actual}
                  onChange={(e) => setStudentForm({ ...studentForm, semestre_actual: e.target.value })}
                >
                  {[1, 2, 3, 4, 5, 6].map((semestre) => (
                    <option key={semestre} value={semestre}>Semestre {semestre}</option>
                  ))}
                </select>
                {user.rol === 'director' && (
                  <select
                    value={studentForm.docente_id}
                    onChange={(e) => setStudentForm({ ...studentForm, docente_id: e.target.value })}
                  >
                    <option value="">Seleccionar docente</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>{teacher.nombre} ({teacher.email})</option>
                    ))}
                  </select>
                )}
                <button type="submit" className="primary-btn">Guardar estudiante</button>
              </form>
            </div>

            <div className="panel-card table-card">
              <h3>Listado de estudiantes</h3>
              <div className="table-toolbar"><input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Buscar estudiante o docente" /><select value={semesterFilter} onChange={(event) => setSemesterFilter(event.target.value)}><option value="all">Todos los semestres</option>{[1,2,3,4,5,6].map((semester) => <option key={semester} value={semester}>Semestre {semester}</option>)}</select></div>
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Semestre</th>
                    <th>Docente</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <tr key={student.id}>
                      <td>{student.nombre}</td>
                      <td>{student.semestre_actual}</td>
                      <td>{student.docente_nombre || 'Sin docente'}</td>
                      <td><span className={`badge ${student.estado}`}>{student.estado}</span></td>
                      <td>
                        {student.estado !== 'retirado' && (
                          <div className="row-actions"><button className="secondary-btn small-btn" onClick={() => setEditingStudent({ ...student })}>Editar</button><button className="secondary-btn small-btn" onClick={() => handleRetireStudent(student.id)}>Retirar</button></div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'patients' && (
          <div className="module-grid">
            <div className="panel-card form-card">
              <h3>Registrar paciente</h3>
              <form onSubmit={handleCreatePatient} className="stack-form">
                <input value={patientForm.nombre} onChange={(e) => setPatientForm({ ...patientForm, nombre: e.target.value })} placeholder="Nombre completo" />
                <div className="two-columns">
                  <input value={patientForm.telefono} onChange={(e) => setPatientForm({ ...patientForm, telefono: e.target.value })} placeholder="Teléfono" />
                  <input value={patientForm.edad} onChange={(e) => setPatientForm({ ...patientForm, edad: e.target.value })} placeholder="Edad" type="number" />
                </div>
                <input value={patientForm.diagnostico} onChange={(e) => setPatientForm({ ...patientForm, diagnostico: e.target.value })} placeholder="Diagnóstico clínico" />
                <input value={patientForm.tipo_maloclusion} onChange={(e) => setPatientForm({ ...patientForm, tipo_maloclusion: e.target.value })} placeholder="Tipo de maloclusión" />
                <div className="two-columns inline-checks">
                  <label><input type="checkbox" checked={patientForm.quirurgico} onChange={(e) => setPatientForm({ ...patientForm, quirurgico: e.target.checked })} /> Caso quirúrgico</label>
                  <label><input type="checkbox" checked={patientForm.extracciones} onChange={(e) => setPatientForm({ ...patientForm, extracciones: e.target.checked })} /> Requiere extracciones</label>
                </div>
                <textarea value={patientForm.notas} onChange={(e) => setPatientForm({ ...patientForm, notas: e.target.value })} placeholder="Notas clínicas generales" rows="3" />
                <div className="two-columns">
                  <select value={patientForm.estudiante_id} onChange={(e) => setPatientForm({ ...patientForm, estudiante_id: e.target.value })}>
                    <option value="">Sin asignar</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>{student.nombre}</option>
                    ))}
                  </select>
                  <select value={patientForm.semestre} onChange={(e) => setPatientForm({ ...patientForm, semestre: e.target.value })}>
                    {[1, 2, 3, 4, 5, 6].map((semestre) => (
                      <option key={semestre} value={semestre}>Semestre {semestre}</option>
                    ))}
                  </select>
                </div>
                <input type="date" value={patientForm.fecha_ingreso} onChange={(e) => setPatientForm({ ...patientForm, fecha_ingreso: e.target.value })} />
                <button type="submit" className="primary-btn">Guardar paciente</button>
              </form>
            </div>

            <div className="panel-card table-card">
              <h3>Pacientes</h3>
              <div className="table-toolbar"><input value={patientSearch} onChange={(event) => setPatientSearch(event.target.value)} placeholder="Buscar paciente" /><select value={patientStatusFilter} onChange={(event) => setPatientStatusFilter(event.target.value)}><option value="all">Todos los estados</option><option value="activo">Activos</option><option value="sin_asignar">Sin asignar</option></select></div>
              <table>
                <thead>
                  <tr>
                    <th>Paciente</th>
                    <th>Estudiante</th>
                    <th>Semestre</th>
                    <th>Estado</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.map((patient) => (
                    <tr key={patient.id}>
                      <td>{patient.nombre}</td>
                      <td>{patient.estudiante_nombre || 'Sin asignar'}{patient.estudiante_id && <small className="capacity-inline">{students.find((student) => student.id === patient.estudiante_id)?.pacientes_activos || 0}/10</small>}</td>
                      <td>{patient.semestre}</td>
                      <td><span className={`badge ${patient.estado}`}>{patient.estado}</span></td>
                      <td><div className="row-actions"><button className="secondary-btn small-btn" onClick={() => openPatientDetail(patient.id)}>Ver</button><button className="secondary-btn small-btn" onClick={() => setEditingPatient({ ...patient })}>Editar</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredPatients.length === 0 && <div className="empty-state">No hay pacientes que coincidan con los filtros.</div>}
            </div>

            <div className="panel-card">
              <h3>Pacientes sin asignar</h3>
              <ul className="mini-list">
                {(unassignedPatients || []).map((patient) => (
                  <li key={patient.id}>
                    <span>{patient.nombre}</span>
                    <button className="secondary-btn small-btn" onClick={() => openPatientDetail(patient.id)}>Reasignar</button>
                  </li>
                ))}
              </ul>
            </div>

            <PatientDetailPanel patient={selectedPatientDetail} sessions={selectedPatientSessions} students={students} onReassign={handleReassignPatient} onUploadPhoto={handleUploadPhoto} />
          </div>
        )}

        {activeTab === 'sessions' && (
          <div className="module-grid">
            <div className="panel-card form-card">
              <h3>Registrar atención</h3>
              <form onSubmit={handleCreateSession} className="stack-form">
                <select value={sessionForm.paciente_id} onChange={(e) => setSessionForm({ ...sessionForm, paciente_id: e.target.value })}>
                  <option value="">Seleccione paciente</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>{patient.nombre}</option>
                  ))}
                </select>
                <select value={sessionForm.estudiante_id} onChange={(e) => setSessionForm({ ...sessionForm, estudiante_id: e.target.value })}>
                  <option value="">Seleccione estudiante</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>{student.nombre}</option>
                  ))}
                </select>
                <div className="two-columns">
                  <input type="date" value={sessionForm.fecha} onChange={(e) => setSessionForm({ ...sessionForm, fecha: e.target.value })} />
                  <select value={sessionForm.semestre} onChange={(e) => setSessionForm({ ...sessionForm, semestre: e.target.value })}>
                    {[1, 2, 3, 4, 5, 6].map((semestre) => (
                      <option key={semestre} value={semestre}>Semestre {semestre}</option>
                    ))}
                  </select>
                </div>
                <input value={sessionForm.procedimiento} onChange={(e) => setSessionForm({ ...sessionForm, procedimiento: e.target.value })} placeholder="Procedimiento realizado" />
                <textarea value={sessionForm.observaciones} onChange={(e) => setSessionForm({ ...sessionForm, observaciones: e.target.value })} placeholder="Observaciones" rows="3" />
                <button type="submit" className="primary-btn">Guardar atención</button>
              </form>
            </div>

            <div className="panel-card table-card">
              <h3>Historial clínico</h3>
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Paciente</th>
                    <th>Estudiante</th>
                    <th>Procedimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.id}>
                      <td>{session.fecha}</td>
                      <td>{session.paciente_nombre}</td>
                      <td>{session.estudiante_nombre}</td>
                      <td>{session.procedimiento}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'rubrics' && (
          <div className="module-grid">
            <div className="panel-card form-card">
              <h3>Crear rúbrica</h3>
              <form onSubmit={handleCreateRubric} className="stack-form">
                <select value={rubricForm.semestre} onChange={(e) => setRubricForm({ ...rubricForm, semestre: e.target.value })}>
                  {[1, 2, 3, 4, 5, 6].map((semestre) => (
                    <option key={semestre} value={semestre}>Semestre {semestre}</option>
                  ))}
                </select>
                <input
                  value={rubricForm.nombre}
                  onChange={(e) => setRubricForm({ ...rubricForm, nombre: e.target.value })}
                  placeholder="Nombre de la rúbrica"
                />
                <textarea
                  value={rubricForm.descripcion}
                  onChange={(e) => setRubricForm({ ...rubricForm, descripcion: e.target.value })}
                  placeholder="Descripción"
                  rows="3"
                />
                <input
                  value={rubricForm.peso_meta}
                  onChange={(e) => setRubricForm({ ...rubricForm, peso_meta: e.target.value })}
                  placeholder="Meta"
                  type="number"
                />
                <button type="submit" className="primary-btn">Guardar rúbrica</button>
              </form>
            </div>

            <RubricPanel students={students} rubrics={studentRubrics} selectedStudentId={selectedStudentId || students[0]?.id} onEvaluate={handleEvaluateRubric} />
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="module-grid">
            <div className="panel-card">
              <h3>Estudiantes</h3>
              <ul className="mini-list">
                {students.map((student) => (
                  <li key={student.id}>
                    <span>{student.nombre}</span>
                    <button className="secondary-btn small-btn" onClick={() => setSelectedStudentId(student.id)}>Ver reporte</button>
                  </li>
                ))}
              </ul>
            </div>

            <ReportCard
              student={students.find((item) => item.id === selectedStudentId) || null}
              report={studentReport}
              onExport={handleExportReport}
              onExportXlsx={() => downloadReportFile('xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
              onExportPdf={() => downloadReportFile('pdf', 'application/pdf')}
              onPrint={handlePrintReport}
            />
          </div>
        )}

        {editingStudent && (
          <div className="modal-backdrop" role="presentation" onMouseDown={() => setEditingStudent(null)}>
            <form className="modal-card" onSubmit={handleUpdateStudent} onMouseDown={(event) => event.stopPropagation()}>
              <span className="eyebrow">GESTIÓN ACADÉMICA</span><h3>Editar estudiante</h3>
              <label>Nombre<input required value={editingStudent.nombre || ''} onChange={(event) => setEditingStudent({ ...editingStudent, nombre: event.target.value })} /></label>
              <label>Semestre<select value={editingStudent.semestre_actual} onChange={(event) => setEditingStudent({ ...editingStudent, semestre_actual: Number(event.target.value) })}>{[1,2,3,4,5,6].map((semester) => <option key={semester} value={semester}>{semester}</option>)}</select></label>
              <div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setEditingStudent(null)}>Cancelar</button><button type="submit" className="primary-btn">Guardar cambios</button></div>
            </form>
          </div>
        )}

        {editingPatient && (
          <div className="modal-backdrop" role="presentation" onMouseDown={() => setEditingPatient(null)}>
            <form className="modal-card" onSubmit={handleUpdatePatient} onMouseDown={(event) => event.stopPropagation()}>
              <span className="eyebrow">FICHA CLÍNICA</span><h3>Editar paciente</h3>
              <label>Nombre<input required value={editingPatient.nombre || ''} onChange={(event) => setEditingPatient({ ...editingPatient, nombre: event.target.value })} /></label>
              <label>Diagnóstico<input value={editingPatient.diagnostico || ''} onChange={(event) => setEditingPatient({ ...editingPatient, diagnostico: event.target.value })} /></label>
              <label>Notas<textarea value={editingPatient.notas || ''} onChange={(event) => setEditingPatient({ ...editingPatient, notas: event.target.value })} /></label>
              <div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setEditingPatient(null)}>Cancelar</button><button type="submit" className="primary-btn">Guardar cambios</button></div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
