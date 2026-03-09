import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/utils/auth';
import { proposalCreateSchema } from '@/lib/validators/rfq';
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, validationErrorResponse } from '@/lib/utils/response';
import { generateProposalNumber } from '@/lib/utils/helpers';

// Get proposals
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const rfqId = searchParams.get('rfqId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};

    // Role-based filtering
    if (user.role === 'SUPPLIER') {
      where.supplierId = user.id;
    } else if (user.role === 'CLIENT') {
      // Clients see proposals shared with them
      where.isShared = true;
      if (rfqId) {
        where.rfqId = rfqId;
      }
    }
    // Admins see all proposals

    if (status) {
      where.status = status;
    }

    if (rfqId && user.role !== 'CLIENT') {
      where.rfqId = rfqId;
    }

    const proposals = await db.proposal.findMany({
      where,
      include: {
        rfq: {
          include: {
            client: {
              select: {
                id: true,
                name: true,
                company: true,
                email: true,
              },
            },
          },
        },
        supplier: {
          select: {
            id: true,
            name: true,
            company: true,
            email: true,
            logo: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse({ proposals });
  } catch (error) {
    console.error('Get proposals error:', error);
    return errorResponse('Failed to get proposals', 500);
  }
}

// Create proposal (suppliers only)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return unauthorizedResponse();
    }

    if (user.role !== 'SUPPLIER' && user.role !== 'ADMIN') {
      return forbiddenResponse();
    }

    const body = await request.json();
    
    // Validate input
    const validationResult = proposalCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const data = validationResult.data;

    // Check if RFQ exists and supplier is assigned
    const rfq = await db.rFQRequest.findUnique({
      where: { id: data.rfqId },
    });

    if (!rfq) {
      return errorResponse('RFQ not found', 404);
    }

    // Check if supplier is assigned or RFQ is open
    if (user.role === 'SUPPLIER') {
      const assignedSuppliers = rfq.assignedSuppliers ? JSON.parse(rfq.assignedSuppliers) : [];
      if (!assignedSuppliers.includes(user.id) && rfq.status !== 'SUBMITTED') {
        return errorResponse('You are not assigned to this RFQ', 403);
      }
    }

    // Check for existing proposal
    const existingProposal = await db.proposal.findFirst({
      where: {
        rfqId: data.rfqId,
        supplierId: user.id,
      },
    });

    if (existingProposal) {
      return errorResponse('You have already submitted a proposal for this RFQ', 400);
    }

    // Generate proposal number
    const proposalNumber = generateProposalNumber();

    // Calculate totals
    let subtotal = 0;
    for (const item of data.lineItems) {
      subtotal += item.totalPrice || (item.quantity * item.unitPrice);
    }

    // Create proposal
    const proposal = await db.proposal.create({
      data: {
        proposalNumber,
        rfqId: data.rfqId,
        supplierId: user.id,
        lineItems: JSON.stringify(data.lineItems),
        subtotal,
        currency: data.currency,
        attachments: body.attachments ? JSON.stringify(body.attachments) : null,
        notes: data.notes || null,
        deliveryTerms: data.deliveryTerms || null,
        validity: data.validity || null,
        status: 'SUBMITTED',
        grandTotal: subtotal, // Will be updated by admin
      },
      include: {
        rfq: {
          include: {
            client: {
              select: {
                id: true,
                name: true,
                company: true,
                email: true,
              },
            },
          },
        },
        supplier: {
          select: {
            id: true,
            name: true,
            company: true,
            email: true,
          },
        },
      },
    });

    // Update RFQ status if first proposal
    const proposalCount = await db.proposal.count({
      where: { rfqId: data.rfqId },
    });

    if (proposalCount === 1 && rfq.status === 'ASSIGNED') {
      await db.rFQRequest.update({
        where: { id: data.rfqId },
        data: { status: 'QUOTES_RECEIVED' },
      });
    }

    return successResponse({ proposal }, 'Proposal submitted successfully');
  } catch (error) {
    console.error('Create proposal error:', error);
    return errorResponse('Failed to create proposal', 500);
  }
}
