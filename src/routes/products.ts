import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../prisma';
import { authenticateAdmin } from '../middleware/auth';

const router = Router();

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../uploads');
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (dirErr) {
  // Ignored in read-only / serverless deployment environments
}

// Multer Config
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'battery-' + uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
});

// GET /api/products - Get all products
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, search } = req.query;

    const whereClause: any = {};
    if (category && typeof category === 'string' && category !== 'All') {
      whereClause.category = category;
    }
    if (search && typeof search === 'string') {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { chemistry: { contains: search, mode: 'insensitive' } },
        { voltage: { contains: search, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ products });
  } catch (error) {
    console.error('Error fetching products:', error);
    return res.status(500).json({ error: 'Failed to fetch products.' });
  }
});

// GET /api/products/:idOrSlug - Get single product
router.get('/:idOrSlug', async (req: Request, res: Response) => {
  try {
    const idOrSlug = req.params.idOrSlug as string;

    const product = await prisma.product.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    return res.json({ product });
  } catch (error) {
    return res.status(500).json({ error: 'Error retrieving product.' });
  }
});

// POST /api/products/upload - Admin image upload
router.post('/upload', authenticateAdmin, upload.array('images', 5), (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded.' });
    }

    const imageUrls = files.map((file) => `/uploads/${file.filename}`);
    return res.json({ imageUrls });
  } catch (error) {
    return res.status(500).json({ error: 'Image upload failed.' });
  }
});

// POST /api/products - Admin create product
router.post('/', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      price,
      compareAtPrice,
      voltage,
      capacity,
      chemistry,
      maxDischarge,
      cycleLife,
      dimensions,
      weight,
      connectorType,
      category,
      images,
      stock,
      isFeatured,
    } = req.body;

    if (!name || !price || !voltage || !capacity || !chemistry) {
      return res.status(400).json({ error: 'Missing required product fields.' });
    }

    // Generate unique slug
    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }

    const newProduct = await prisma.product.create({
      data: {
        name,
        slug,
        description: description || '',
        price: parseFloat(price),
        compareAtPrice: compareAtPrice ? parseFloat(compareAtPrice) : null,
        voltage,
        capacity,
        chemistry,
        maxDischarge: maxDischarge || null,
        cycleLife: cycleLife || null,
        dimensions: dimensions || null,
        weight: weight || null,
        connectorType: connectorType || null,
        category: category || 'Custom Battery',
        images: Array.isArray(images) && images.length > 0 ? images : ['https://images.unsplash.com/photo-1619725002198-6a689b72f41d?auto=format&fit=crop&q=80&w=800'],
        stock: stock ? parseInt(stock) : 10,
        isFeatured: Boolean(isFeatured),
      },
    });

    return res.status(201).json({ message: 'Product created successfully', product: newProduct });
  } catch (error: any) {
    console.error('Error creating product:', error);
    return res.status(500).json({ error: error.message || 'Failed to create product.' });
  }
});

// PUT /api/products/:id - Admin edit product
router.put('/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const {
      name,
      description,
      price,
      compareAtPrice,
      voltage,
      capacity,
      chemistry,
      maxDischarge,
      cycleLife,
      dimensions,
      weight,
      connectorType,
      category,
      images,
      stock,
      isFeatured,
    } = req.body;

    const existingProduct = await prisma.product.findUnique({ where: { id } });
    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existingProduct.name,
        description: description !== undefined ? description : existingProduct.description,
        price: price !== undefined ? parseFloat(price) : existingProduct.price,
        compareAtPrice: compareAtPrice !== undefined ? (compareAtPrice ? parseFloat(compareAtPrice) : null) : existingProduct.compareAtPrice,
        voltage: voltage !== undefined ? voltage : existingProduct.voltage,
        capacity: capacity !== undefined ? capacity : existingProduct.capacity,
        chemistry: chemistry !== undefined ? chemistry : existingProduct.chemistry,
        maxDischarge: maxDischarge !== undefined ? maxDischarge : existingProduct.maxDischarge,
        cycleLife: cycleLife !== undefined ? cycleLife : existingProduct.cycleLife,
        dimensions: dimensions !== undefined ? dimensions : existingProduct.dimensions,
        weight: weight !== undefined ? weight : existingProduct.weight,
        connectorType: connectorType !== undefined ? connectorType : existingProduct.connectorType,
        category: category !== undefined ? category : existingProduct.category,
        images: Array.isArray(images) ? images : existingProduct.images,
        stock: stock !== undefined ? parseInt(stock) : existingProduct.stock,
        isFeatured: isFeatured !== undefined ? Boolean(isFeatured) : existingProduct.isFeatured,
      },
    });

    return res.json({ message: 'Product updated successfully', product: updatedProduct });
  } catch (error: any) {
    console.error('Error updating product:', error);
    return res.status(500).json({ error: 'Failed to update product.' });
  }
});

// DELETE /api/products/:id - Admin delete product
router.delete('/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const existingProduct = await prisma.product.findUnique({ where: { id } });
    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    await prisma.product.delete({ where: { id } });

    return res.json({ message: 'Product deleted successfully.' });
  } catch (error) {
    console.error('Error deleting product:', error);
    return res.status(500).json({ error: 'Failed to delete product.' });
  }
});

export default router;
