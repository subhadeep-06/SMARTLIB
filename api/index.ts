import express from 'express';
import { apiRouter } from '../src/server/apiRoutes';
import { getStore } from '../src/server/store';

// Initialize institutional seed store (uses /tmp on Vercel serverless runtime)
getStore();

const app = express();
app.use(express.json({ limit: '4mb' }));

// CORS headers for Vercel deployment and optional cross-origin clients
app.use((req, res, next) => {
  const allowedOrigin = process.env.FRONTEND_URL;
  const origin = req.headers.origin;
  if (allowedOrigin && origin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  } else if (origin && process.env.VERCEL_URL && origin.includes(process.env.VERCEL_URL)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.use('/api', apiRouter);
app.use('/', apiRouter);

export default app;
