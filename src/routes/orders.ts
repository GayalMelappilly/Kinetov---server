import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { authenticateAdmin } from '../middleware/auth';

const router = Router();

// Helper to generate custom order numbers (e.g. CBS-2026-9812)
const generateOrderNumber = () => {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `CBS-${new Date().getFullYear()}-${rand}`;
};

// POST /api/orders - Guest Checkout (No auth required)
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      address,
      city,
      state,
      pincode,
      items,
      paymentMethod, // "UPI" | "ONLINE"
      paymentUpiTxnId,
    } = req.body;

    if (
      !customerName ||
      !customerEmail ||
      !customerPhone ||
      !address ||
      !city ||
      !state ||
      !pincode ||
      !items ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({ error: 'Please provide all shipping details and items.' });
    }

    // Calculate total amount from current product prices
    let totalAmount = 0;
    const orderItemData = [];

    for (const item of items) {
      if (!item.productId || !item.quantity) continue;

      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        return res.status(400).json({ error: `Product with ID ${item.productId} not found.` });
      }

      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;

      orderItemData.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        price: product.price,
      });

      // Update product stock
      await prisma.product.update({
        where: { id: product.id },
        data: { stock: Math.max(0, product.stock - item.quantity) },
      });
    }

    const orderNumber = generateOrderNumber();

    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerName,
        customerEmail,
        customerPhone,
        address,
        city,
        state,
        pincode,
        totalAmount,
        paymentMethod: paymentMethod || 'UPI',
        paymentStatus: 'PAID', // Online payments are marked PAID upon checkout completion
        paymentUpiTxnId: paymentUpiTxnId || `UPI-${Date.now()}`,
        orderStatus: 'PROCESSING',
        items: {
          create: orderItemData,
        },
      },
      include: {
        items: true,
      },
    });

    return res.status(201).json({
      message: 'Order placed successfully!',
      order,
    });
  } catch (error: any) {
    console.error('Error creating order:', error);
    return res.status(500).json({ error: 'Failed to place order.' });
  }
});

// GET /api/orders/:orderNumber - Fetch order details by order number (public receipt check)
router.get('/:orderNumber', async (req: Request, res: Response) => {
  try {
    const orderNumber = req.params.orderNumber as string;

    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id: orderNumber }, { orderNumber }],
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    return res.json({ order });
  } catch (error) {
    return res.status(500).json({ error: 'Error fetching order.' });
  }
});

// Admin GET /api/orders/admin/all - Get all orders
router.get('/admin/all', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
      },
    });

    return res.json({ orders });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch admin orders.' });
  }
});

// Admin PUT /api/orders/admin/:id/status - Update order status
router.put('/admin/:id/status', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { orderStatus, paymentStatus } = req.body;

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        orderStatus: orderStatus || undefined,
        paymentStatus: paymentStatus || undefined,
      },
      include: {
        items: true,
      },
    });

    return res.json({ message: 'Order status updated', order: updatedOrder });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update order status.' });
  }
});

export default router;
