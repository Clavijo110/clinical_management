export default function UniversityBrand({ compact = false, inverse = false }) {
  return (
    <div className={`university-brand ${compact ? 'is-compact' : ''} ${inverse ? 'is-inverse' : ''}`}>
      <img className="university-logo" src="/logoUV_Oficial_Rojo.jpg" alt="Universidad del Valle" />
      {!compact && (
        <div className="university-brand-copy">
          <strong>UNIVERSIDAD DEL VALLE</strong>
          <span>Posgrado de Ortodoncia</span>
          <small>Sistema de Gestión Clínica</small>
        </div>
      )}
    </div>
  );
}
