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
