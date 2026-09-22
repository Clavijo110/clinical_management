import { createClient } from '@supabase/supabase-js';

const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'patient-photos';
let client;

function getClient() {
  if (!client) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase Storage no está configurado. Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.');
    }
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  }
  return client;
}

export async function uploadPatientPhoto(patientId, buffer, contentType, extension) {
  const path = `patients/${patientId}/identification-${Date.now()}.${extension}`;
  const { error } = await getClient().storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: true
  });
  if (error) throw error;
  return path;
}

export async function getPatientPhotoUrl(path) {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/uploads/')) return path;
  const { data, error } = await getClient().storage.from(bucket).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
