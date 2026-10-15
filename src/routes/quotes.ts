import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { authenticateAdmin } from '../middleware/auth';

const router = Router();

// Public: Submit quote/sell battery request
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, email, phone, type, voltageReq, capacityReq, application, notes } = req.body;

    if (!name || !email || !phone || !notes) {
      return res.status(400).json({ error: 'Name, email, phone, and details are required.' });
    }

    const quote = await prisma.customBatteryQuote.create({
      data: {
        name,
        email,
        phone,
        type: type || 'BUY_CUSTOM',
        voltageReq: voltageReq || null,
        capacityReq: capacityReq || null,
        application: application || null,
        notes,
      },
    });

    return res.status(201).json({ message: 'Request submitted successfully!', quote });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to submit quote request.' });
  }
});

// Admin: Get all quotes
router.get('/admin/all', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const quotes = await prisma.customBatteryQuote.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ quotes });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch quotes.' });
  }
});

// Admin: Update quote status
router.put('/admin/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    const updated = await prisma.customBatteryQuote.update({
      where: { id },
      data: { status },
    });

    return res.json({ message: 'Quote status updated', quote: updated });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update quote.' });
  }
});

export default router;
