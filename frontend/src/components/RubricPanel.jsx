export default function RubricPanel({ students, rubrics, selectedStudentId, onEvaluate }) {
  const student = students.find((item) => item.id === selectedStudentId) || null;

  if (!student) {
    return <div className="panel-card">Seleccione un estudiante para ver la rúbrica.</div>;
  }

  return (
    <div className="panel-card">
      <h3>Rúbricas de {student.nombre}</h3>
      <div className="rubric-list">
        {(rubrics || []).map((rubric) => (
          <div key={rubric.id} className="rubric-item">
            <div className="rubric-head">
              <strong>{rubric.nombre}</strong>
              <span>{rubric.porcentaje ?? 0}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={rubric.porcentaje ?? 0}
              onChange={(e) => onEvaluate(student.id, rubric.id, Number(e.target.value))}
            />
            <small>Meta: {rubric.peso_meta}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
