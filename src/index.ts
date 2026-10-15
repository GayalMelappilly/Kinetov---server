import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import prisma from './prisma';
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import orderRoutes from './routes/orders';
import quoteRoutes from './routes/quotes';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

// Security: Disable X-Powered-By
app.disable('x-powered-by');

// Security Headers Middleware
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Production-ready dynamic CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      // In development or if wildcard is configured, allow all origins
      if (!isProduction || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Body parsers with limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint with database connectivity check
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    // Quick DB ping
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      store: 'Kinetov API',
      environment: NODE_ENV,
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'degraded',
      store: 'Kinetov API',
      environment: NODE_ENV,
      database: 'disconnected',
      error: isProduction ? 'Database unreachable' : error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// API Routes
app.use('/api/admin', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/quotes', quoteRoutes);

// 404 Route Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Centralized Error Handling Middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  const statusCode = err.status || err.statusCode || 500;
  const message = isProduction ? 'Internal Server Error' : (err.message || 'Unknown Server Error');
  res.status(statusCode).json({ error: message });
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`⚡ Kinetov Backend running in [${NODE_ENV}] mode on http://localhost:${PORT}`);
  console.log(`🔒 Allowed CORS Origins: ${isProduction ? allowedOrigins.join(', ') : 'All origins (Development)'}`);
});

// Graceful Shutdown
const handleShutdown = async (signal: string) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log('✅ Database connection closed. Exiting process.');
      process.exit(0);
    } catch (dbErr) {
      console.error('❌ Error disconnecting from database:', dbErr);
      process.exit(1);
    }
  });

  // Force exit if shutdown hangs after 10 seconds
  setTimeout(() => {
    console.error('⚠️ Forcefully terminating server after timeout.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
