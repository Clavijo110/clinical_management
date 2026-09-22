# Sistema de Gestión Clínica — Posgrado de Ortodoncia UV

## Arquitectura propuesta

Se implementa una solución full-stack con:

- Frontend: React + Vite + CSS modular
- Backend: Node.js + Express
- Base de datos: SQLite para entorno local y preparación para migración a PostgreSQL/Supabase
- Autenticación: JWT con hashes bcrypt
- Almacenamiento de archivos: almacenamiento local para MVP, preparado para Supabase Storage
- PDF: jsPDF para reportes semestrales

### Justificación

- Mantiene un MVP funcional y desplegable sin depender de servicios externos.
- Permite mantener seguridad, validaciones y reglas de negocio reforzadas en backend.
- Es suficiente para el objetivo del proyecto académico y se puede migrar fácilmente a PostgreSQL/Supabase en producción.
- Evita complejidad innecesaria de microservicios.

## Estructura de carpetas

```text
uv-clinical-system/
├─ backend/
│  ├─ src/
│  │  ├─ config/
│  │  ├─ controllers/
│  │  ├─ middleware/
│  │  ├─ models/
│  │  ├─ routes/
│  │  ├─ services/
│  │  ├─ utils/
│  │  ├─ app.js
│  │  └─ server.js
│  ├─ data/
│  │  └─ clinical.db
│  ├─ tests/
│  ├─ package.json
│  └─ .env.example
├─ frontend/
│  ├─ src/
│  ├─ public/
│  ├─ package.json
│  └─ vite.config.js
├─ docs/
│  └─ architecture.md
├─ README.md
├─ .gitignore
└─ package.json
```

## Esquema de base de datos

### users
- id UUID
- nombre
- email
- rol (director | docente)
- password_hash
- created_at
- updated_at

### students
- id UUID
- nombre
- docente_id
- semestre_actual
- estado (activo | retirado)
- created_at
- updated_at

### patients
- id UUID
- nombre
- telefono
- edad
- foto_url
- diagnostico
- tipo_maloclusion
- quirurgico (boolean)
- extracciones (boolean)
- notas
- estudiante_id nullable
- semestre
- fecha_ingreso
- estado (activo | sin_asignar)
- created_at
- updated_at

### clinical_sessions
- id UUID
- paciente_id
- estudiante_id
- fecha
- procedimiento
- observaciones
- semestre
- created_at

### rubrics
- id UUID
- semestre
- nombre
- descripcion
- peso_meta
- activo

### rubric_evaluations
- id UUID
- rubric_id
- estudiante_id
- valor
- porcentaje
- fecha

### audit_logs
- id UUID
- user_id
- action
- entity
- entity_id
- old_value
- new_value
- created_at

## Principales reglas de negocio

1. Solo Director y Docente pueden iniciar sesión.
2. Un docente solo accede a su propia información.
3. El Director puede consultar toda la información.
4. Un estudiante retirado no se elimina físicamente.
5. Sus pacientes pasan a estado "sin_asignar".
6. Los pacientes sin asignar pueden reasignarse.
7. El historial clínico se preserva.
8. Cada estudiante puede atender máximo 10 pacientes activos por mes.
9. El programa maneja 6 semestres.
10. Las atenciones se guardan con su semestre original.
11. Las rúbricas son configurables por semestre.
12. Los estudiantes no tienen acceso al sistema.

## Fases

- Fase 1: login, roles, dashboards, estudiantes, pacientes, atenciones, progreso.
- Fase 2: fotografías, rúbricas, evaluación automática.
- Fase 3: PDF, Excel, auditoría, recordatorios.

## Inicio de la implementación

Se inicia con la arquitectura base y luego el MVP funcional en backend y frontend.

## Ejecución local en Windows

Requisitos: Node.js 18 o superior.

Desde la carpeta raíz del proyecto:

```powershell
npm.cmd run install:all
powershell -ExecutionPolicy Bypass -File .\start-dev.ps1
```

La aplicación quedará disponible en:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4001/api/health`

También puede ejecutarse con `npm.cmd run dev`. El script crea automáticamente `backend/data` para SQLite y arranca ambos servicios.

La base de datos local se crea en `backend/data/clinical.db` y se inicializa con usuarios y datos demo. No se requiere instalar una base de datos adicional para el MVP.

Variables opcionales:

- Copiar `backend/.env.example` como `backend/.env` y cambiar `JWT_SECRET` antes de publicar.
- Copiar `frontend/.env.example` como `frontend/.env` si el backend cambia de puerto o URL.

Para compilar el frontend:

```powershell
npm.cmd run build
```

Credenciales demo:

- Director: `director@uv.edu.co` / `Admin123!`
- Docente: `docente1@uv.edu.co` / `Docente123!`

## Dependencias para producción

Para uso local no falta ninguna dependencia externa. Para una puesta en producción todavía deben definirse:

- PostgreSQL/Supabase como reemplazo de SQLite.
- Almacenamiento privado para fotografías clínicas.
- Servicio de correo para recordatorios.
- Gestión de secretos y copias de seguridad.
- Generación PDF nativa y exportación Excel si se requiere un archivo `.pdf` o `.xlsx` automático; el MVP actual ofrece impresión del reporte y exportación CSV compatible con Excel.

## Seguridad de credenciales

Las claves, contraseñas y API keys deben escribirse directamente en `backend/.env`, que está excluido por `.gitignore`. No deben aparecer en React, commits, capturas ni mensajes.

Como se compartieron credenciales de Supabase y Resend durante esta conversación, revócalas y genera nuevas antes de usarlas en producción. La URL de Supabase no es secreta; la contraseña de base de datos, `anon key`, `service_role key` y Resend API key sí deben permanecer privadas.

El endpoint protegido `POST /api/notifications/test-email` permite validar Resend con un usuario Director una vez configurados `RESEND_API_KEY` y `EMAIL_FROM`.

## Logo institucional

El asset `frontend/public/logo-univalle.svg` usa el logo entregado para esta interfaz. Si la Universidad entrega una versión oficial vectorial o PNG de mayor resolución, reemplaza ese archivo conservando el mismo nombre; no es necesario modificar React ni CSS.

## Ruta recomendada de producción

1. Crear un proyecto en Supabase y guardar `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` únicamente en el backend.
2. Crear las tablas PostgreSQL equivalentes al esquema de este README, habilitar claves foráneas e índices y migrar los datos de `backend/data/clinical.db` mediante un script controlado.
3. Crear un bucket privado `patient-photos` en Supabase Storage. El backend debe generar URLs firmadas; nunca exponer la service role key al navegador.
4. Desplegar el backend en Render, Railway o Fly.io con `DATABASE_URL`, `JWT_SECRET`, credenciales de Supabase y variables SMTP.
5. Desplegar el frontend en Vercel o Netlify con `VITE_API_URL=https://api.tu-dominio.com/api`.
6. Comprar o usar un dominio, crear un registro DNS para `app.tu-dominio.com` y otro para `api.tu-dominio.com`, y apuntarlos al proveedor elegido. Vercel, Netlify y Render gestionan certificados HTTPS automáticos después de verificar DNS.
7. Configurar copias de seguridad: backups diarios de Supabase/PostgreSQL, retención mínima de 30 días, exportación semanal cifrada y una prueba mensual de restauración. No respaldar `.env` ni claves dentro del repositorio.
8. Configurar un proveedor SMTP como Resend, Brevo o SendGrid. Crear una API key o credenciales SMTP, verificar el dominio remitente y guardar los secretos solo en el backend.

### PDF y Excel nativos

Puppeteer y `exceljs` ya están instalados en `backend/package.json`. La aplicación genera PDF nativo desde `/api/reports/student/:id/export.pdf` y Excel nativo desde `/api/reports/student/:id/export.xlsx`, además de conservar CSV e impresión. No requieren claves externas; Puppeteer sí necesita que Chromium esté disponible en el servidor de producción.
