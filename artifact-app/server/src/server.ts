import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import claudeRoutes from './routes/claude.js';
import artifactRoutes from './routes/artifacts.js';

dotenv.config({ path: '../../.env' });

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/claude', claudeRoutes);
app.use('/api/artifacts', artifactRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
