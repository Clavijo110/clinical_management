import app from './app.js';
import { initializeDatabase } from './config/db.js';

const PORT = process.env.PORT || 4000;

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Error starting backend:', error);
    process.exit(1);
  });
