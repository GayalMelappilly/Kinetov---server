-- ==============================================================================
-- KINETOV - CLOUDFLARE D1 SQLITE SCHEMA
-- Execute via: npx wrangler d1 execute <DATABASE_NAME> --remote --file=./d1/schema.sql
-- ==============================================================================

-- Drop existing tables if recreating (safe for initial migrations)
DROP TABLE IF EXISTS "OrderItem";
DROP TABLE IF EXISTS "Order";
DROP TABLE IF EXISTS "CustomBatteryQuote";
DROP TABLE IF EXISTS "Product";
DROP TABLE IF EXISTS "Admin";

-- 1. Admin Table
CREATE TABLE "Admin" (
    "id" TEXT PRIMARY KEY,
    "username" TEXT NOT NULL UNIQUE,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'System Admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Product Table
CREATE TABLE "Product" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL UNIQUE,
    "description" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "compareAtPrice" REAL,
    "voltage" TEXT NOT NULL,
    "capacity" TEXT NOT NULL,
    "chemistry" TEXT NOT NULL,
    "maxDischarge" TEXT,
    "cycleLife" TEXT,
    "dimensions" TEXT,
    "weight" TEXT,
    "connectorType" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Custom Battery',
    "images" TEXT NOT NULL DEFAULT '[]', -- JSON stringified array of URLs
    "stock" INTEGER NOT NULL DEFAULT 10,
    "isFeatured" BOOLEAN NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Order Table
CREATE TABLE "Order" (
    "id" TEXT PRIMARY KEY,
    "orderNumber" TEXT NOT NULL UNIQUE,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'UPI',
    "paymentStatus" TEXT NOT NULL DEFAULT 'PAID',
    "paymentUpiTxnId" TEXT,
    "orderStatus" TEXT NOT NULL DEFAULT 'PROCESSING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Order Item Table
CREATE TABLE "OrderItem" (
    "id" TEXT PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE,
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL
);

-- 5. Custom Battery Quote / Sell Battery Request Table
CREATE TABLE "CustomBatteryQuote" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'BUY_CUSTOM',
    "voltageReq" TEXT,
    "capacityReq" TEXT,
    "application" TEXT,
    "notes" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indices for Fast Queries
CREATE INDEX IF NOT EXISTS "idx_product_slug" ON "Product"("slug");
CREATE INDEX IF NOT EXISTS "idx_product_category" ON "Product"("category");
CREATE INDEX IF NOT EXISTS "idx_order_orderNumber" ON "Order"("orderNumber");
CREATE INDEX IF NOT EXISTS "idx_orderitem_orderId" ON "OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "idx_quote_status" ON "CustomBatteryQuote"("status");
