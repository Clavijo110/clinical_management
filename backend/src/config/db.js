import sqlite3 from 'sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDirectory = path.join(__dirname, '../../data');
fs.mkdirSync(dataDirectory, { recursive: true });
const dbPath = path.join(dataDirectory, 'clinical.db');

export const db = new sqlite3.Database(dbPath);

export function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

export function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

export async function logAudit({ userId, action, entity, entityId, oldValue, newValue }) {
  await run(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), userId || null, action, entity, entityId || null, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null]
  );
}

export async function initializeDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      rol TEXT NOT NULL CHECK(rol IN ('director','docente')),
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      docente_id TEXT NOT NULL,
      semestre_actual INTEGER NOT NULL CHECK(semestre_actual BETWEEN 1 AND 6),
      estado TEXT NOT NULL CHECK(estado IN ('activo','retirado')) DEFAULT 'activo',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (docente_id) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      telefono TEXT,
      edad INTEGER,
      foto_url TEXT,
      diagnostico TEXT,
      tipo_maloclusion TEXT,
      quirurgico INTEGER NOT NULL DEFAULT 0,
      extracciones INTEGER NOT NULL DEFAULT 0,
      notas TEXT,
      estudiante_id TEXT,
      semestre INTEGER NOT NULL CHECK(semestre BETWEEN 1 AND 6),
      fecha_ingreso TEXT NOT NULL,
      estado TEXT NOT NULL CHECK(estado IN ('activo','sin_asignar')) DEFAULT 'activo',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (estudiante_id) REFERENCES students(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS clinical_sessions (
      id TEXT PRIMARY KEY,
      paciente_id TEXT NOT NULL,
      estudiante_id TEXT NOT NULL,
      fecha TEXT NOT NULL,
      procedimiento TEXT NOT NULL,
      observaciones TEXT,
      semestre INTEGER NOT NULL CHECK(semestre BETWEEN 1 AND 6),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (paciente_id) REFERENCES patients(id),
      FOREIGN KEY (estudiante_id) REFERENCES students(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS rubrics (
      id TEXT PRIMARY KEY,
      semestre INTEGER NOT NULL CHECK(semestre BETWEEN 1 AND 6),
      nombre TEXT NOT NULL,
      descripcion TEXT,
      peso_meta REAL NOT NULL,
      activo INTEGER NOT NULL DEFAULT 1
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS rubric_evaluations (
      id TEXT PRIMARY KEY,
      rubric_id TEXT NOT NULL,
      estudiante_id TEXT NOT NULL,
      valor REAL NOT NULL,
      porcentaje REAL NOT NULL,
      fecha TEXT NOT NULL,
      FOREIGN KEY (rubric_id) REFERENCES rubrics(id),
      FOREIGN KEY (estudiante_id) REFERENCES students(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      old_value TEXT,
      new_value TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_rubric_evaluations_student_rubric ON rubric_evaluations (estudiante_id, rubric_id)`);

  const existingUsers = await query('SELECT COUNT(*) as total FROM users');
  if (Number(existingUsers[0].total) === 0) {
    const directorId = uuidv4();
    const docente1Id = uuidv4();
    const docente2Id = uuidv4();

    const directorHash = await bcrypt.hash('Admin123!', 10);
    const teacherHash = await bcrypt.hash('Docente123!', 10);

    await run(
      `INSERT INTO users (id, nombre, email, rol, password_hash) VALUES (?, ?, ?, ?, ?)`,
      [directorId, 'Director Clínica', 'director@uv.edu.co', 'director', directorHash]
    );
    await run(
      `INSERT INTO users (id, nombre, email, rol, password_hash) VALUES (?, ?, ?, ?, ?)`,
      [docente1Id, 'Dra. Carolina Ruiz', 'docente1@uv.edu.co', 'docente', teacherHash]
    );
    await run(
      `INSERT INTO users (id, nombre, email, rol, password_hash) VALUES (?, ?, ?, ?, ?)`,
      [docente2Id, 'Dr. Luis Gómez', 'docente2@uv.edu.co', 'docente', teacherHash]
    );

    const studentIds = [
      uuidv4(), uuidv4(), uuidv4(), uuidv4(), uuidv4(), uuidv4(), uuidv4(), uuidv4()
    ];

    const students = [
      ['Ana María López', docente1Id, 3],
      ['Mateo Ramírez', docente1Id, 4],
      ['Valentina Torres', docente1Id, 2],
      ['Santiago Castro', docente2Id, 5],
      ['Camila Vargas', docente2Id, 1],
      ['Daniel Herrera', docente1Id, 6],
      ['Paula Naranjo', docente2Id, 3],
      ['Jorge Álvarez', docente2Id, 4]
    ];

    for (let i = 0; i < studentIds.length; i += 1) {
      const [nombre, docenteId, semestre] = students[i];
      await run(
        `INSERT INTO students (id, nombre, docente_id, semestre_actual, estado) VALUES (?, ?, ?, ?, 'activo')`,
        [studentIds[i], nombre, docenteId, semestre]
      );
    }

    const patientIds = [
      uuidv4(), uuidv4(), uuidv4(), uuidv4(), uuidv4(), uuidv4(),
      uuidv4(), uuidv4(), uuidv4(), uuidv4(), uuidv4(), uuidv4(),
      uuidv4(), uuidv4(), uuidv4()
    ];

    const patients = [
      ['Luis Ortega', '3001234567', 21, null, 'Mordida cruzada posterior', 'Clase III', 0, 1, 'Control inicial.', studentIds[0], 3, '2025-01-10', 'activo'],
      ['María Peña', '3007654321', 26, null, 'Apiñamiento leve', 'Clase I', 0, 0, 'Sin complicaciones.', studentIds[0], 3, '2025-02-05', 'activo'],
      ['Andrés Sosa', '3011122233', 19, null, 'Sobremordida', 'Clase II', 0, 0, 'Seguimiento por sobremordida.', studentIds[1], 4, '2025-01-18', 'activo'],
      ['Laura Mejía', '3012345678', 28, null, 'Mordida abierta', 'Clase II', 1, 0, 'Requiere observación quirúrgica.', studentIds[1], 4, '2025-02-12', 'activo'],
      ['Cristian Ríos', '3023456789', 31, null, 'Protrusión maxilar', 'Clase III', 0, 1, 'Se recomienda extracción de premolares.', studentIds[2], 2, '2025-03-02', 'activo'],
      ['Sara Molina', '3033456789', 23, null, 'Alineación dental', 'Clase I', 0, 0, 'Control de progresión.', studentIds[3], 5, '2025-01-25', 'activo'],
      ['Felipe Díaz', '3044567890', 17, null, 'Mordida profunda', 'Clase II', 0, 0, 'Atención de seguimiento.', studentIds[3], 5, '2025-04-09', 'activo'],
      ['Clara Gutiérrez', '3055678901', 29, null, 'Diastema', 'Clase I', 0, 0, 'Cierre de espacios.', studentIds[4], 1, '2025-02-15', 'activo'],
      ['José Pardo', '3066789012', 24, null, 'Asimetría facial', 'Clase III', 1, 0, 'Caso quirúrgico pendiente.', studentIds[5], 6, '2025-01-30', 'activo'],
      ['Viviana Ortiz', '3077890123', 20, null, 'Mordida cruzada', 'Clase II', 0, 1, 'Extracciones previstas.', studentIds[5], 6, '2025-03-10', 'activo'],
      ['Diego Torres', '3088901234', 34, null, 'Maloclusión severa', 'Clase III', 1, 1, 'Necesita evaluación integral.', null, 4, '2025-04-20', 'sin_asignar'],
      ['Patricia León', '3099012345', 22, null, 'Apertura anterior', 'Clase II', 0, 0, 'Paciente nuevo sin asignar.', null, 2, '2025-05-03', 'sin_asignar'],
      ['Nicolás Bello', '3100123456', 18, null, 'Mordida profunda', 'Clase I', 0, 0, 'Seguimiento de ajuste.', studentIds[6], 3, '2025-02-22', 'activo'],
      ['Marcela Urrutia', '3111234567', 27, null, 'Desalineación', 'Clase I', 0, 1, 'Requiere extracción de 4 premolares.', studentIds[7], 4, '2025-03-18', 'activo'],
      ['Oscar Rojas', '3122345678', 33, null, 'Sobremordida', 'Clase II', 0, 0, 'Paciente con historial largo.', studentIds[7], 4, '2025-04-14', 'activo'],
    ];

    for (let i = 0; i < patientIds.length; i += 1) {
      const [nombre, telefono, edad, fotoUrl, diagnostico, tipoMaloclusion, quirurgico, extracciones, notas, estudianteId, semestre, fechaIngreso, estado] = patients[i];
      await run(
        `INSERT INTO patients (id, nombre, telefono, edad, foto_url, diagnostico, tipo_maloclusion, quirurgico, extracciones, notas, estudiante_id, semestre, fecha_ingreso, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [patientIds[i], nombre, telefono, edad, fotoUrl, diagnostico, tipoMaloclusion, quirurgico, extracciones, notas, estudianteId, semestre, fechaIngreso, estado]
      );
    }

    const sessionIds = [
      uuidv4(), uuidv4(), uuidv4(), uuidv4(), uuidv4(), uuidv4(),
      uuidv4(), uuidv4(), uuidv4(), uuidv4(), uuidv4(), uuidv4(),
      uuidv4(), uuidv4(), uuidv4(), uuidv4()
    ];

    const sessions = [
      [patientIds[0], studentIds[0], '2025-01-12', 'Ajuste de arco', 'Se retuvo una semana.', 3],
      [patientIds[0], studentIds[0], '2025-02-08', 'Colocación de bandas', 'Se reforzó la mordida.', 3],
      [patientIds[1], studentIds[0], '2025-03-10', 'Control de progresión', 'Buen avance.', 3],
      [patientIds[2], studentIds[1], '2025-01-28', 'Ajuste de brackets', 'Paciente estable.', 4],
      [patientIds[3], studentIds[1], '2025-02-17', 'Evaluación prequirúrgica', 'Se revisó plan.', 4],
      [patientIds[4], studentIds[2], '2025-03-15', 'Selección de extracciones', 'Revisión del plan.', 2],
      [patientIds[5], studentIds[3], '2025-02-18', 'Control de seguimiento', 'Sin complicaciones.', 5],
      [patientIds[6], studentIds[3], '2025-04-20', 'Ajuste de alineadores', 'Mejora visual.', 5],
      [patientIds[7], studentIds[4], '2025-02-20', 'Control de diastema', 'Se observa cierre parcial.', 1],
      [patientIds[8], studentIds[5], '2025-02-06', 'Revisión quirúrgica', 'Fase de preparación.', 6],
      [patientIds[9], studentIds[5], '2025-03-25', 'Ajuste de retenedores', 'Se favorece la estabilidad.', 6],
      [patientIds[12], studentIds[6], '2025-03-12', 'Seguimiento de mordida', 'Se mantiene tratamiento.', 3],
      [patientIds[13], studentIds[7], '2025-04-05', 'Colocación de brackets', 'Caso nuevo.', 4],
      [patientIds[14], studentIds[7], '2025-04-25', 'Ajuste de arcada', 'Se observa avance.', 4],
      [patientIds[1], studentIds[0], '2025-05-09', 'Control final', 'Paciente cumple metas.', 3],
      [patientIds[5], studentIds[3], '2025-05-15', 'Revisión de cierre', 'Seguimiento adecuado.', 5],
    ];

    for (let i = 0; i < sessionIds.length; i += 1) {
      const [pacienteId, estudianteId, fecha, procedimiento, observaciones, semestre] = sessions[i];
      await run(
        `INSERT INTO clinical_sessions (id, paciente_id, estudiante_id, fecha, procedimiento, observaciones, semestre) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [sessionIds[i], pacienteId, estudianteId, fecha, procedimiento, observaciones, semestre]
      );
    }

    const rubricIds = [uuidv4(), uuidv4(), uuidv4()];
    const rubricData = [
      [rubricIds[0], 1, 'Atenciones', 'Meta de controles por semestre', 12],
      [rubricIds[1], 3, 'Calidad clínica', 'Evaluación de calidad', 100],
      [rubricIds[2], 5, 'Requisitos clínicos', 'Cumplimiento de requerimientos', 10],
    ];

    for (const [id, semestre, nombre, descripcion, meta] of rubricData) {
      await run(
        `INSERT INTO rubrics (id, semestre, nombre, descripcion, peso_meta, activo) VALUES (?, ?, ?, ?, ?, 1)`,
        [id, semestre, nombre, descripcion, meta]
      );
    }
  }
}
