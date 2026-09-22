import pg from 'pg';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL no está configurada. Define la URI PostgreSQL de Supabase en Render.');
    }
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.DB_POOL_MAX || 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });
  }
  return pool;
}

function toPostgresQuery(sql, params) {
  let index = 0;
  return {
    text: sql.replace(/\?/g, () => `$${++index}`),
    values: params
  };
}

export async function query(sql, params = []) {
  const result = await getPool().query(toPostgresQuery(sql, params));
  return result.rows;
}

export async function run(sql, params = []) {
  const result = await getPool().query(toPostgresQuery(sql, params));
  return { changes: result.rowCount, rows: result.rows };
}

export async function logAudit({ userId, action, entity, entityId, oldValue, newValue }) {
  await run(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), userId || null, action, entity, entityId || null, oldValue || null, newValue || null]
  );
}

async function ensureSchema() {
  await getPool().query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  await getPool().query(`DO $$ BEGIN CREATE TYPE user_role AS ENUM ('director', 'docente'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
  await getPool().query(`DO $$ BEGIN CREATE TYPE student_status AS ENUM ('activo', 'retirado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
  await getPool().query(`DO $$ BEGIN CREATE TYPE patient_status AS ENUM ('activo', 'sin_asignar'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);

  await getPool().query(`CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY, nombre text NOT NULL, email text NOT NULL UNIQUE, rol user_role NOT NULL, password_hash text NOT NULL, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now())`);
  await getPool().query(`CREATE TABLE IF NOT EXISTS students (id uuid PRIMARY KEY, nombre text NOT NULL, docente_id uuid NOT NULL REFERENCES users(id), semestre_actual smallint NOT NULL CHECK (semestre_actual BETWEEN 1 AND 6), estado student_status NOT NULL DEFAULT 'activo', created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now())`);
  await getPool().query(`CREATE TABLE IF NOT EXISTS patients (id uuid PRIMARY KEY, nombre text NOT NULL, telefono text, edad smallint CHECK (edad BETWEEN 0 AND 120), foto_url text, diagnostico text, tipo_maloclusion text, quirurgico boolean NOT NULL DEFAULT false, extracciones boolean NOT NULL DEFAULT false, notas text, estudiante_id uuid REFERENCES students(id), semestre smallint NOT NULL CHECK (semestre BETWEEN 1 AND 6), fecha_ingreso date NOT NULL, estado patient_status NOT NULL DEFAULT 'activo', created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now())`);
  await getPool().query(`CREATE TABLE IF NOT EXISTS clinical_sessions (id uuid PRIMARY KEY, paciente_id uuid NOT NULL REFERENCES patients(id), estudiante_id uuid NOT NULL REFERENCES students(id), fecha date NOT NULL, procedimiento text NOT NULL, observaciones text, semestre smallint NOT NULL CHECK (semestre BETWEEN 1 AND 6), created_at timestamptz DEFAULT now())`);
  await getPool().query(`CREATE TABLE IF NOT EXISTS rubrics (id uuid PRIMARY KEY, semestre smallint NOT NULL CHECK (semestre BETWEEN 1 AND 6), nombre text NOT NULL, descripcion text, peso_meta numeric NOT NULL CHECK (peso_meta > 0), activo boolean NOT NULL DEFAULT true)`);
  await getPool().query(`CREATE TABLE IF NOT EXISTS rubric_evaluations (id uuid PRIMARY KEY, rubric_id uuid NOT NULL REFERENCES rubrics(id), estudiante_id uuid NOT NULL REFERENCES students(id), valor numeric NOT NULL CHECK (valor >= 0), porcentaje numeric NOT NULL CHECK (porcentaje BETWEEN 0 AND 100), fecha timestamptz NOT NULL DEFAULT now(), UNIQUE (estudiante_id, rubric_id))`);
  await getPool().query(`CREATE TABLE IF NOT EXISTS audit_logs (id uuid PRIMARY KEY, user_id uuid REFERENCES users(id), action text NOT NULL, entity text NOT NULL, entity_id uuid, old_value jsonb, new_value jsonb, created_at timestamptz DEFAULT now())`);
  await getPool().query(`CREATE INDEX IF NOT EXISTS idx_students_docente ON students(docente_id)`);
  await getPool().query(`CREATE INDEX IF NOT EXISTS idx_patients_student ON patients(estudiante_id)`);
  await getPool().query(`CREATE INDEX IF NOT EXISTS idx_patients_date ON patients(fecha_ingreso)`);
  await getPool().query(`CREATE INDEX IF NOT EXISTS idx_sessions_student ON clinical_sessions(estudiante_id)`);
  await getPool().query(`CREATE INDEX IF NOT EXISTS idx_sessions_patient ON clinical_sessions(paciente_id)`);
  await getPool().query(`CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC)`);
}

export async function seedDemoData() {
  const directorHash = await bcrypt.hash('Admin123!', 10);
  const teacherHash = await bcrypt.hash('Docente123!', 10);

  async function ensureUser(email, name, role, passwordHash) {
    const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing[0]) return existing[0].id;
    const id = uuidv4();
    await run('INSERT INTO users (id, nombre, email, rol, password_hash) VALUES (?, ?, ?, ?, ?)', [id, name, email, role, passwordHash]);
    return id;
  }

  const directorId = await ensureUser('director@uv.edu.co', 'Director Clínica', 'director', directorHash);
  const teacherOneId = await ensureUser('docente1@uv.edu.co', 'Dra. Carolina Ruiz', 'docente', teacherHash);
  const teacherTwoId = await ensureUser('docente2@uv.edu.co', 'Dr. Luis Gómez', 'docente', teacherHash);
  const existingStudents = await query('SELECT COUNT(*)::int AS total FROM students');
  if (existingStudents[0]?.total > 0) return;

  const studentRows = [
    ['Ana María López', teacherOneId, 3], ['Mateo Ramírez', teacherOneId, 4], ['Valentina Torres', teacherOneId, 2],
    ['Santiago Castro', teacherTwoId, 5], ['Camila Vargas', teacherTwoId, 1], ['Daniel Herrera', teacherOneId, 6],
    ['Paula Naranjo', teacherTwoId, 3], ['Jorge Álvarez', teacherTwoId, 4]
  ];
  const studentIds = [];
  for (const [name, teacherId, semester] of studentRows) {
    const id = uuidv4(); studentIds.push(id);
    await run(`INSERT INTO students (id, nombre, docente_id, semestre_actual, estado) VALUES (?, ?, ?, ?, 'activo')`, [id, name, teacherId, semester]);
  }

  const patientRows = [
    ['Luis Ortega', studentIds[0], 3, 'Mordida cruzada posterior', 'Clase III', false, true],
    ['María Peña', studentIds[0], 3, 'Apiñamiento leve', 'Clase I', false, false],
    ['Andrés Sosa', studentIds[1], 4, 'Sobremordida', 'Clase II', false, false],
    ['Laura Mejía', studentIds[1], 4, 'Mordida abierta', 'Clase II', true, false],
    ['Cristian Ríos', studentIds[2], 2, 'Protrusión maxilar', 'Clase III', false, true],
    ['Sara Molina', studentIds[3], 5, 'Alineación dental', 'Clase I', false, false],
    ['Felipe Díaz', studentIds[3], 5, 'Mordida profunda', 'Clase II', false, false],
    ['Clara Gutiérrez', studentIds[4], 1, 'Diastema', 'Clase I', false, false],
    ['José Pardo', studentIds[5], 6, 'Asimetría facial', 'Clase III', true, false],
    ['Viviana Ortiz', studentIds[5], 6, 'Mordida cruzada', 'Clase II', false, true],
    ['Diego Torres', null, 4, 'Maloclusión severa', 'Clase III', true, true],
    ['Patricia León', null, 2, 'Apertura anterior', 'Clase II', false, false],
    ['Nicolás Bello', studentIds[6], 3, 'Mordida profunda', 'Clase I', false, false],
    ['Marcela Urrutia', studentIds[7], 4, 'Desalineación', 'Clase I', false, true],
    ['Oscar Rojas', studentIds[7], 4, 'Sobremordida', 'Clase II', false, false]
  ];
  const patientIds = [];
  for (let i = 0; i < patientRows.length; i += 1) {
    const [name, studentId, semester, diagnosis, malocclusion, surgical, extraction] = patientRows[i];
    const id = uuidv4(); patientIds.push(id);
    const date = `2025-${String((i % 5) + 1).padStart(2, '0')}-${String((i % 20) + 1).padStart(2, '0')}`;
    await run(`INSERT INTO patients (id, nombre, telefono, edad, diagnostico, tipo_maloclusion, quirurgico, extracciones, notas, estudiante_id, semestre, fecha_ingreso, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, name, `300${String(1234567 + i)}`, 18 + i, diagnosis, malocclusion, surgical, extraction, 'Dato demo para validación.', studentId, semester, date, studentId ? 'activo' : 'sin_asignar']);
  }

  const sessionRows = [[0, 0, '2025-01-12', 'Ajuste de arco', 3], [0, 0, '2025-02-08', 'Colocación de bandas', 3], [1, 0, '2025-03-10', 'Control de progresión', 3], [2, 1, '2025-01-28', 'Ajuste de brackets', 4], [3, 1, '2025-02-17', 'Evaluación prequirúrgica', 4], [4, 2, '2025-03-15', 'Selección de extracciones', 2], [5, 3, '2025-02-18', 'Control de seguimiento', 5], [6, 3, '2025-04-20', 'Ajuste de alineadores', 5], [7, 4, '2025-02-20', 'Control de diastema', 1], [8, 5, '2025-02-06', 'Revisión quirúrgica', 6], [9, 5, '2025-03-25', 'Ajuste de retenedores', 6], [12, 6, '2025-03-12', 'Seguimiento de mordida', 3], [13, 7, '2025-04-05', 'Colocación de brackets', 4], [14, 7, '2025-04-25', 'Ajuste de arcada', 4]];
  for (const [patientIndex, studentIndex, date, procedure, semester] of sessionRows) {
    await run(`INSERT INTO clinical_sessions (id, paciente_id, estudiante_id, fecha, procedimiento, observaciones, semestre) VALUES (?, ?, ?, ?, ?, ?, ?)`, [uuidv4(), patientIds[patientIndex], studentIds[studentIndex], date, procedure, 'Atención demo.', semester]);
  }

  for (const [semester, name, description, goal] of [[1, 'Atenciones', 'Meta de controles por semestre', 12], [3, 'Calidad clínica', 'Evaluación de calidad', 100], [5, 'Requisitos clínicos', 'Cumplimiento de requerimientos', 10]]) {
    await run(`INSERT INTO rubrics (id, semestre, nombre, descripcion, peso_meta, activo) VALUES (?, ?, ?, ?, ?, true)`, [uuidv4(), semester, name, description, goal]);
  }
}

export async function initializeDatabase() {
  await ensureSchema();
  await seedDemoData();
  await query('SELECT 1');
}
