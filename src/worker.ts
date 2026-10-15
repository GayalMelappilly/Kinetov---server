/**
 * KINETOV - CLOUDFLARE WORKER + D1 REST API
 * Native Cloudflare Edge handler querying Cloudflare D1 serverless SQLite database.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Minimal Cloudflare D1 interfaces
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: Record<string, unknown>;
  error?: string;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}

export interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  ALLOWED_ORIGINS?: string;
  NODE_ENV?: string;
}

function getCorsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('Origin') || '';
  
  // Always permit localhost, any vercel.app domain, and configured origins
  let isAllowed = false;
  if (!origin || !env.ALLOWED_ORIGINS || env.ALLOWED_ORIGINS.includes('*')) {
    isAllowed = true;
  } else {
    const allowedList = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
    isAllowed =
      allowedList.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1');
  }

  return {
    'Access-Control-Allow-Origin': isAllowed ? (origin || '*') : origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data: unknown, status = 200, corsHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

function formatProduct(row: any) {
  return {
    ...row,
    isFeatured: Boolean(row.isFeatured),
    images: typeof row.images === 'string' ? JSON.parse(row.images || '[]') : row.images || [],
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = getCorsHeaders(request, env);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // 1. Health check
      if (path === '/api/health' && method === 'GET') {
        let dbStatus = 'connected';
        try {
          await env.DB.prepare('SELECT 1').first();
        } catch {
          dbStatus = 'disconnected';
        }
        return jsonResponse(
          {
            status: 'ok',
            store: 'Kinetov API (Cloudflare D1 Worker)',
            runtime: 'cloudflare-worker',
            database: dbStatus,
            timestamp: new Date().toISOString(),
          },
          200,
          corsHeaders
        );
      }

      // 2. GET /api/products
      if (path === '/api/products' && method === 'GET') {
        const category = url.searchParams.get('category');
        const search = url.searchParams.get('search');

        let query = 'SELECT * FROM "Product" WHERE 1=1';
        const params: unknown[] = [];

        if (category && category !== 'All') {
          query += ' AND category = ?';
          params.push(category);
        }

        if (search) {
          query += ' AND (name LIKE ? OR description LIKE ? OR chemistry LIKE ? OR voltage LIKE ?)';
          const pattern = `%${search}%`;
          params.push(pattern, pattern, pattern, pattern);
        }

        query += ' ORDER BY createdAt DESC';

        const { results } = await env.DB.prepare(query).bind(...params).all();
        const products = (results || []).map(formatProduct);
        return jsonResponse({ products }, 200, corsHeaders);
      }

      // 3. GET /api/products/:slugOrId
      if (path.startsWith('/api/products/') && method === 'GET') {
        const idOrSlug = path.replace('/api/products/', '');
        const product = await env.DB.prepare(
          'SELECT * FROM "Product" WHERE id = ? OR slug = ? LIMIT 1'
        )
          .bind(idOrSlug, idOrSlug)
          .first();

        if (!product) {
          return jsonResponse({ error: 'Product not found.' }, 404, corsHeaders);
        }
        return jsonResponse({ product: formatProduct(product) }, 200, corsHeaders);
      }

      // 4. POST /api/orders (Guest checkout)
      if (path === '/api/orders' && method === 'POST') {
        const body: any = await request.json();
        const { customerName, customerEmail, customerPhone, address, city, state, pincode, items, paymentMethod, paymentUpiTxnId } = body;

        if (!customerName || !customerEmail || !customerPhone || !items?.length) {
          return jsonResponse({ error: 'Missing required order fields.' }, 400, corsHeaders);
        }

        const orderId = `order-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const orderNumber = `CBS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

        let totalAmount = 0;
        const itemInserts = [];

        for (const item of items) {
          const prod: any = await env.DB.prepare('SELECT id, name, price, stock FROM "Product" WHERE id = ?')
            .bind(item.productId)
            .first();

          if (!prod) continue;
          totalAmount += prod.price * item.quantity;

          itemInserts.push({
            id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            orderId,
            productId: prod.id,
            productName: prod.name,
            quantity: item.quantity,
            price: prod.price,
          });

          // Deduct stock
          await env.DB.prepare('UPDATE "Product" SET stock = MAX(0, stock - ?) WHERE id = ?')
            .bind(item.quantity, prod.id)
            .run();
        }

        await env.DB.prepare(
          `INSERT INTO "Order" (id, orderNumber, customerName, customerEmail, customerPhone, address, city, state, pincode, totalAmount, paymentMethod, paymentStatus, paymentUpiTxnId, orderStatus)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            orderId,
            orderNumber,
            customerName,
            customerEmail,
            customerPhone,
            address || '',
            city || '',
            state || '',
            pincode || '',
            totalAmount,
            paymentMethod || 'UPI',
            'PAID',
            paymentUpiTxnId || `UPI-${Date.now()}`,
            'PROCESSING'
          )
          .run();

        for (const it of itemInserts) {
          await env.DB.prepare(
            `INSERT INTO "OrderItem" (id, orderId, productId, productName, quantity, price)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
            .bind(it.id, it.orderId, it.productId, it.productName, it.quantity, it.price)
            .run();
        }

        return jsonResponse(
          {
            message: 'Order placed successfully!',
            order: {
              id: orderId,
              orderNumber,
              customerName,
              customerEmail,
              totalAmount,
              paymentMethod: paymentMethod || 'UPI',
              paymentStatus: 'PAID',
              orderStatus: 'PROCESSING',
              items: itemInserts,
              createdAt: new Date().toISOString(),
            },
          },
          201,
          corsHeaders
        );
      }

      // 5. GET /api/orders/:orderNumber
      if (path.startsWith('/api/orders/') && method === 'GET' && !path.includes('/admin/')) {
        const orderNumber = path.replace('/api/orders/', '');
        const order: any = await env.DB.prepare(
          'SELECT * FROM "Order" WHERE orderNumber = ? OR id = ? LIMIT 1'
        )
          .bind(orderNumber, orderNumber)
          .first();

        if (!order) {
          return jsonResponse({ error: 'Order not found.' }, 404, corsHeaders);
        }

        const { results: items } = await env.DB.prepare(
          'SELECT * FROM "OrderItem" WHERE orderId = ?'
        )
          .bind(order.id)
          .all();

        return jsonResponse({ order: { ...order, items: items || [] } }, 200, corsHeaders);
      }

      // 6. POST /api/quotes
      if (path === '/api/quotes' && method === 'POST') {
        const body: any = await request.json();
        const { name, email, phone, type, voltageReq, capacityReq, application, notes } = body;

        if (!name || !email || !phone || !notes) {
          return jsonResponse({ error: 'Name, email, phone, and details are required.' }, 400, corsHeaders);
        }

        const quoteId = `quote-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

        await env.DB.prepare(
          `INSERT INTO "CustomBatteryQuote" (id, name, email, phone, type, voltageReq, capacityReq, application, notes, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            quoteId,
            name,
            email,
            phone,
            type || 'BUY_CUSTOM',
            voltageReq || null,
            capacityReq || null,
            application || null,
            notes,
            'NEW'
          )
          .run();

        return jsonResponse({ message: 'Request submitted successfully!', quote: { id: quoteId, ...body } }, 201, corsHeaders);
      }

      // 7. POST /api/admin/login
      if (path === '/api/admin/login' && method === 'POST') {
        const { username, password }: any = await request.json();
        if (!username || !password) {
          return jsonResponse({ error: 'Username and password are required.' }, 400, corsHeaders);
        }

        const admin: any = await env.DB.prepare('SELECT * FROM "Admin" WHERE username = ? LIMIT 1')
          .bind(username)
          .first();

        if (!admin || !(await bcrypt.compare(password, admin.password))) {
          return jsonResponse({ error: 'Invalid username or password.' }, 401, corsHeaders);
        }

        const secret = env.JWT_SECRET || 'custom_battery_secret_jwt_key_2026_super_secure';
        const token = jwt.sign({ id: admin.id, username: admin.username }, secret, { expiresIn: '24h' });

        return jsonResponse(
          {
            message: 'Login successful',
            token,
            admin: { id: admin.id, username: admin.username, name: admin.name },
          },
          200,
          corsHeaders
        );
      }

      // 8. Admin endpoints
      if (path === '/api/orders/admin/all' && method === 'GET') {
        const { results: orders } = await env.DB.prepare('SELECT * FROM "Order" ORDER BY createdAt DESC').all();
        return jsonResponse({ orders: orders || [] }, 200, corsHeaders);
      }

      if (path === '/api/quotes/admin/all' && method === 'GET') {
        const { results: quotes } = await env.DB.prepare('SELECT * FROM "CustomBatteryQuote" ORDER BY createdAt DESC').all();
        return jsonResponse({ quotes: quotes || [] }, 200, corsHeaders);
      }

      return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
    } catch (err: any) {
      console.error('Worker error:', err);
      return jsonResponse(
        { error: err.message || 'Internal server error' },
        500,
        corsHeaders
      );
    }
  },
};
