import express, { type NextFunction, type Request, type Response } from 'express';
import { apiRouter } from '../src/server/apiRoutes.js';
import { ensureStoreHydrated, flushStore } from '../src/server/store.js';

const app = express();
app.use(express.json({ limit: '4mb' }));

// Hydrate state from MongoDB Atlas (if MONGODB_URI is set) and flush mutations before serverless exit
app.use(async (req, res, next) => {
  try {
    await ensureStoreHydrated();
  } catch (err) {
    console.error('[SMARTLIB] Store hydration fallback:', err);
  }
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      flushStore()
        .catch((err) => console.error('[SMARTLIB] MongoDB flush error:', err))
        .finally(() => {
          originalJson(body);
        });
      return res;
    }) as typeof res.json;
  }
  next();
});

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

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Internal server error';
  console.error('[SMARTLIB API ERROR]', err);
  res.status(500).json({ success: false, message });
});

export default app;
