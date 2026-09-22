import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import studentRoutes from './routes/students.js';
import patientRoutes from './routes/patients.js';
import sessionRoutes from './routes/clinical-sessions.js';
import dashboardRoutes from './routes/dashboard.js';
import rubricRoutes from './routes/rubrics.js';
import reportRoutes from './routes/reports.js';
import auditRoutes from './routes/audit.js';
import notificationRoutes from './routes/notifications.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Sistema clínico operativo.' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/clinical-sessions', sessionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/rubrics', rubricRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/notifications', notificationRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Error interno del servidor.' });
});

export default app;
