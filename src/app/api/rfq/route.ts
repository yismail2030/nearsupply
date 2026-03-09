import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/utils/auth';
import { rfqCreateSchema } from '@/lib/validators/rfq';
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, validationErrorResponse } from '@/lib/utils/response';
import { generateRequestNumber } from '@/lib/utils/helpers';

// Get RFQs
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');

    const where: Record<string, unknown> = {};

    // Role-based filtering
    if (user.role === 'CLIENT') {
      where.clientId = user.id;
    } else if (user.role === 'SUPPLIER') {
      // Suppliers see RFQs assigned to them or open RFQs
      where.OR = [
        { assignedSuppliers: { contains: user.id } },
        { status: 'SUBMITTED' },
      ];
    }
    // Admins see all RFQs

    if (status) {
      where.status = status;
    }

    if (category) {
      where.category = category;
    }

    const rfqs = await db.rFQRequest.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            company: true,
            email: true,
          },
        },
        lineItems: {
          orderBy: { sortOrder: 'asc' },
        },
        proposals: {
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
                company: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse({ rfqs });
  } catch (error) {
    console.error('Get RFQs error:', error);
    return errorResponse('Failed to get RFQs', 500);
  }
}

// Create RFQ (clients only)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return unauthorizedResponse();
    }

    if (user.role !== 'CLIENT' && user.role !== 'ADMIN') {
      return forbiddenResponse();
    }

    const body = await request.json();
    
    // Debug: log the incoming body
    console.log('RFQ Create - Incoming body:', JSON.stringify(body, null, 2));
    
    // Validate input
    const validationResult = rfqCreateSchema.safeParse(body);
    if (!validationResult.success) {
      console.log('RFQ Create - Validation error:', JSON.stringify(validationResult.error.issues, null, 2));
      return validationErrorResponse(validationResult.error);
    }

    const data = validationResult.data;

    // Generate request number
    const requestNumber = generateRequestNumber();

    // Create RFQ with line items
    const rfq = await db.rFQRequest.create({
      data: {
        requestNumber,
        requestType: data.requestType || 'PRODUCT',
        title: data.title,
        description: data.description,
        category: data.category,
        budget: data.budget || null,
        currency: data.currency || 'USD',
        deadlineDate: data.deadlineDate ? new Date(data.deadlineDate) : null,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
        deliveryTerms: data.deliveryTerms || null,
        deliveryAddress: data.deliveryAddress || null,
        notes: data.notes || null,
        internalNotes: data.internalNotes || null,
        attachments: body.attachments ? JSON.stringify(body.attachments) : null,
        status: 'DRAFT',
        clientId: user.id,
        assignedSuppliers: data.assignedSuppliers ? JSON.stringify(data.assignedSuppliers) : null,
        lineItems: {
          create: data.lineItems.map((item, index) => ({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit || null,
            specifications: item.specifications || null,
            link: item.link || null,
            imageUrl: item.imageUrl || null,
            sortOrder: index,
          })),
        },
      },
      include: {
        lineItems: true,
        client: {
          select: {
            id: true,
            name: true,
            company: true,
            email: true,
          },
        },
      },
    });

    return successResponse({ rfq }, 'RFQ created successfully');
  } catch (error) {
    console.error('Create RFQ error:', error);
    return errorResponse('Failed to create RFQ', 500);
  }
}
