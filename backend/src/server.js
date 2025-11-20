import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './db.js';
import { cleanupExpiredSessions } from './auth.js';
import usersRouter from './routes/users.js';
import vaultRouter from './routes/vault.js';
import familyRouter from './routes/family.js';
import sharingRouter from './routes/sharing.js';
import passwordRouter from './routes/password.js';
import recoveryRouter from './routes/recovery.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/users', usersRouter);
app.use('/api/vault', vaultRouter);
app.use('/api/family', familyRouter);
app.use('/api/sharing', sharingRouter);
app.use('/api/password', passwordRouter);
app.use('/api/recovery', recoveryRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start server
async function start() {
  try {
    await initDatabase();

    // Clean up expired sessions periodically
    setInterval(() => {
      cleanupExpiredSessions().catch(console.error);
    }, 60 * 60 * 1000); // Every hour

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
