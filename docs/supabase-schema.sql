-- Ejecutar en Supabase SQL Editor.
-- Este esquema conserva las relaciones del MVP SQLite.

create extension if not exists pgcrypto;

do $$ begin
  create type user_role as enum ('director', 'docente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type student_status as enum ('activo', 'retirado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type patient_status as enum ('activo', 'sin_asignar');
exception when duplicate_object then null; end $$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text not null unique,
  rol user_role not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  docente_id uuid not null references public.users(id),
  semestre_actual smallint not null check (semestre_actual between 1 and 6),
  estado student_status not null default 'activo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  edad smallint check (edad between 0 and 120),
  foto_url text,
  diagnostico text,
  tipo_maloclusion text,
  quirurgico boolean not null default false,
  extracciones boolean not null default false,
  notas text,
  estudiante_id uuid references public.students(id),
  semestre smallint not null check (semestre between 1 and 6),
  fecha_ingreso date not null,
  estado patient_status not null default 'activo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinical_sessions (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.patients(id),
  estudiante_id uuid not null references public.students(id),
  fecha date not null,
  procedimiento text not null,
  observaciones text,
  semestre smallint not null check (semestre between 1 and 6),
  created_at timestamptz not null default now()
);

create table if not exists public.rubrics (
  id uuid primary key default gen_random_uuid(),
  semestre smallint not null check (semestre between 1 and 6),
  nombre text not null,
  descripcion text,
  peso_meta numeric not null check (peso_meta > 0),
  activo boolean not null default true
);

create table if not exists public.rubric_evaluations (
  id uuid primary key default gen_random_uuid(),
  rubric_id uuid not null references public.rubrics(id),
  estudiante_id uuid not null references public.students(id),
  valor numeric not null check (valor >= 0),
  porcentaje numeric not null check (porcentaje between 0 and 100),
  fecha timestamptz not null default now(),
  unique (rubric_id, estudiante_id)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_students_docente on public.students(docente_id);
create index if not exists idx_patients_student on public.patients(estudiante_id);
create index if not exists idx_patients_date on public.patients(fecha_ingreso);
create index if not exists idx_sessions_student on public.clinical_sessions(estudiante_id);
create index if not exists idx_sessions_patient on public.clinical_sessions(paciente_id);
create index if not exists idx_audit_created on public.audit_logs(created_at desc);

-- Storage: crear el bucket privado patient-photos desde Storage > New bucket.
-- No conviertas este bucket en público; las imágenes deben entregarse con URLs firmadas.
