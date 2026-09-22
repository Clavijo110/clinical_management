# Puesta en producción

Esta guía parte de una decisión conservadora: conservar el backend Express y JWT actuales, usar Supabase como PostgreSQL y Storage, y no mezclar Supabase Auth con el JWT propio durante la primera migración.

## 1. Crear Supabase

1. Entra a `https://supabase.com/dashboard` y crea una organización y un proyecto.
2. Elige una región cercana a los usuarios.
3. Guarda la contraseña de la base de datos en un gestor de secretos.
4. En Project Settings > API copia `Project URL` y la `service_role key` solo para el backend.
5. En Database > Connection string copia la URL de conexión para el servidor.

Variables del backend:

```env
NODE_ENV=production
PORT=4001
JWT_SECRET=una-clave-larga-generada-aleatoriamente
DATABASE_URL=postgresql://...
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

Importante: la contraseña que aparece en Database Settings no es una API key. Para conectar el backend necesitas además:

- `Project URL`: ya está identificada en el proyecto.
- `anon key`: Project Settings > API > Project API keys > anon public.
- `service_role key`: Project Settings > API > Project API keys > service_role. Solo backend.
- `DATABASE_URL`: Database > Connect > URI, con host, puerto, usuario, base y contraseña.

No envíes ninguna de esas claves por chat. Abre `backend/.env` localmente y pégalas allí; ese archivo está excluido por `.gitignore`.

Nunca pongas `SUPABASE_SERVICE_ROLE_KEY` en `frontend/.env` ni en código React.

## 2. Migrar el esquema

El MVP actual usa SQLite. Para migrar, crea las tablas PostgreSQL equivalentes a las del esquema de `README.md`, cambiando:

- `TEXT` UUID por `uuid` con `gen_random_uuid()`.
- `INTEGER` booleano por `boolean`.
- `CURRENT_TIMESTAMP` se mantiene.
- Agrega índices sobre `students.docente_id`, `patients.estudiante_id`, `patients.fecha_ingreso`, `clinical_sessions.estudiante_id`, `clinical_sessions.paciente_id` y `audit_logs.created_at`.
- Mantén una restricción única sobre `(estudiante_id, rubric_id)` en `rubric_evaluations`.

Haz primero un respaldo de `backend/data/clinical.db`. La migración de datos debe ser un script separado que lea SQLite y escriba PostgreSQL; no la ejecutes manualmente registro por registro en producción.

## 3. Fotografías con Storage

1. En Supabase Storage crea el bucket privado `patient-photos`.
2. El backend recibe la imagen, valida MIME y tamaño, y la sube usando `SUPABASE_SERVICE_ROLE_KEY`.
3. Guarda en `patients.foto_url` únicamente la ruta del objeto, por ejemplo `patients/<id>/identification.webp`.
4. Cuando se consulte un paciente, el backend genera una URL firmada con caducidad corta.
5. El frontend muestra esa URL, nunca la clave privada.
6. Configura políticas RLS para impedir lectura pública del bucket.

En desarrollo local la aplicación usa `backend/uploads`. En producción debe usarse Storage para evitar perder archivos cuando el servidor se reinicie.

La aplicación local ya valida JPG, PNG y WEBP, con máximo de 5 MB. Para activar Storage remoto, configura `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y el bucket privado; no uses la anon key para subir archivos desde el servidor.

## 4. Desplegar el backend

En Render, Railway o Fly.io:

1. Conecta el repositorio.
2. Directorio de trabajo: `backend`.
3. Instalación: `npm ci`.
4. Inicio: `npm start`.
5. Agrega las variables del backend.
6. Expón el puerto definido por `PORT`.
7. Verifica `https://api.tu-dominio.com/api/health`.

## 5. Desplegar el frontend

En Vercel o Netlify:

1. Conecta el repositorio.
2. Directorio: `frontend`.
3. Instalación: `npm ci`.
4. Build: `npm run build`.
5. Directorio publicado: `dist`.
6. Agrega `VITE_API_URL=https://api.tu-dominio.com/api`.
7. Configura fallback SPA para que `/login` y `/` carguen `index.html`.

## 6. Dominio y HTTPS

1. Compra un dominio en el registrador que prefieras.
2. Usa `app.tu-dominio.com` para Vercel/Netlify.
3. Usa `api.tu-dominio.com` para Render/Railway/Fly.
4. Añade los registros DNS que indique cada proveedor.
5. Espera la propagación y verifica ambos subdominios.
6. Activa HTTPS administrado por el proveedor. No subas certificados privados al repositorio.
7. Configura CORS del backend para aceptar únicamente `https://app.tu-dominio.com`.

## 7. Correo y recordatorios

Recomendación sencilla: Resend o Brevo.

1. Crea la cuenta.
2. Verifica el dominio remitente agregando los registros SPF y DKIM.
3. Crea una API key o credenciales SMTP.
4. Guarda esos secretos solo en el backend.
5. Implementa un servicio `emailService` con plantillas para recordatorios y errores.
6. Usa un cron administrado por el proveedor para ejecutar recordatorios; no dependas de un proceso local.

Variables posibles:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM=clinica@tu-dominio.com
```

Para Resend, la configuración mínima es:

```env
RESEND_API_KEY=re_...
EMAIL_FROM=Clinica de Ortodoncia <clinica@tu-dominio.com>
```

1. Crea o entra a tu cuenta en `https://resend.com`.
2. En Domains agrega tu dominio.
3. Copia los registros DNS SPF y DKIM que Resend indique.
4. Crea una nueva API key con permisos de envío.
5. Escribe la key directamente en `backend/.env`; no la subas a Git.
6. Usa un remitente cuyo dominio aparezca como verificado.
7. Antes de enviar a pacientes, prueba con un correo institucional interno.

## 8. Copias de seguridad

- Activa los backups automáticos de Supabase según el plan contratado.
- Exporta un respaldo cifrado adicional una vez al día o a la semana.
- Conserva al menos 30 días.
- Guarda las fotos en Storage con versionado o una copia independiente.
- Prueba una restauración al menos una vez al mes.
- No incluyas `.env`, claves JWT ni service role keys en los respaldos del repositorio.

## 9. PDF y Excel

Para referencia, PDF nativo desde el backend:

```powershell
cd backend
npm ci
```

Puppeteer renderiza una plantilla HTML y la convierte a PDF. En Render/Railway debes comprobar que el proveedor permita descargar Chromium; si no, usa `puppeteer-core` con un Chromium del entorno o conserva el reporte imprimible actual.

Para referencia, Excel nativo:

```powershell
cd backend
npm ci
```

Crea un libro con hojas `Resumen`, `Pacientes`, `Atenciones`, `Rubricas` y `Progreso` usando `exceljs`, y devuelve `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`. Los endpoints ya implementados son `/api/reports/student/:id/export.pdf` y `/api/reports/student/:id/export.xlsx`.

Estas dos librerías no necesitan claves externas. Solo necesitan `npm ci`, espacio de disco para Chromium en el caso de Puppeteer y pruebas del despliegue.

## 10. Checklist antes de publicar

- `JWT_SECRET` distinto al valor local.
- CORS limitado al dominio real.
- HTTPS activo.
- Base de datos PostgreSQL respaldada.
- Storage privado.
- Service role key únicamente en backend.
- Usuarios demo eliminados o contraseñas cambiadas.
- Logs sin contraseñas ni tokens.
- Prueba de login de director y docente.
- Prueba de aislamiento entre docentes.
- Prueba de retiro y reasignación.
- Prueba de límite de 10 pacientes.
- Prueba de restauración de backup.
