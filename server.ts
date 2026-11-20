import express from 'express';
import path from 'path';
import fs from 'fs';
import 'dotenv/config';
import { apiRouter } from './src/server/apiRoutes';
import { getStore } from './src/server/store';

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

async function bootstrap() {
  // Initialize persistent document store & institutional seed data
  getStore();

  const app = express();
  app.use(express.json({ limit: '4mb' }));

  // Secure CORS configuration
  const allowedOrigin = process.env.FRONTEND_URL;
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigin && origin === allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    } else if (!IS_PROD && origin) {
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

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build artifacts not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SMARTLIB] Server running on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('[SMARTLIB] Failed to start server:', err);
  process.exit(1);
});
