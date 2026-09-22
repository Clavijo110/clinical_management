# Documento de arquitectura

## Decisión técnica

Se utilizó una arquitectura de aplicación monolítica modular con dos capas bien separadas:

- Backend API REST para lógica de negocio, seguridad y persistencia.
- Frontend SPA para interacción y dashboards.

## Objetivos

- Seguridad por backend y validación en frontend.
- Base de datos relacional local para MVP.
- Escalabilidad razonable sin microservicios innecesarios.
- Implementación simple de despliegue local y en producción.

## Seguridad

- Hash de contraseñas con bcrypt.
- JWT con expiración.
- Middleware de autenticación y autorización por rol.
- Validación en servidor para pacientes, estudiantes y atenciones.
- Protección de rutas en frontend.

## Módulos del backend

- Auth
- Users
- Students
- Patients
- Clinical sessions
- Dashboard metrics
- Reports
- Audit logs

## Módulos del frontend

- Login
- Dashboard Director
- Dashboard Docente
- Student management
- Patient management
- Session history
- Progress view
- Reports

## Preparación para Supabase / PostgreSQL

La capa de datos se modela con entidades y relaciones compatibles con PostgreSQL, y la lógica del backend puede migrarse a Supabase con cambios mínimos de configuración.
