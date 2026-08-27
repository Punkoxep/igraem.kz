import express from 'express';
import cors from 'cors';
import path from 'path';
import router from './routes';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Dedicated route for Interactive Web Test & Admin Dashboard (TTLock Mock toggle, Gateways, IIN Validator, Akimat Dashboard)
app.get(['/admin', '/dashboard', '/test-dashboard'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve static React frontend files from client/dist (if built) or public
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));
app.use(express.static(path.join(__dirname, 'public')));

// Dedicated TTLock Webhook & Developer Console Callback (returns 200 OK for GET/POST verification)
app.all(['/ttlock/callback', '/api/v1/ttlock/callback'], (req, res) => {
  console.log(`[TTLock Webhook] Received ${req.method} request on ${req.originalUrl}:`, req.method === 'GET' ? req.query : req.body);
  return res.status(200).send('OK');
});

// API Routes
app.use('/api/v1', router);

// SPA Fallback for non-API GET routes to serve React app
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexHtml = path.join(clientDistPath, 'index.html');
  res.sendFile(indexHtml, (err) => {
    if (err) {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
  });
});


// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[GlobalErrorHandler]', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Внутренняя ошибка сервера',
  });
});

export default app;
