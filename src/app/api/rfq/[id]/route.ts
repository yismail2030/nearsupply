import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/utils/auth';
import { rfqUpdateSchema } from '@/lib/validators/rfq';
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse, validationErrorResponse } from '@/lib/utils/response';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Get single RFQ
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return unauthorizedResponse();
    }

    const { id } = await params;

    const rfq = await db.rFQRequest.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            company: true,
            email: true,
            phone: true,
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
                email: true,
                logo: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!rfq) {
      return notFoundResponse('RFQ');
    }

    // Check access
    if (user.role === 'CLIENT' && rfq.clientId !== user.id) {
      return forbiddenResponse();
    }

    // Check if supplier is assigned or RFQ is open
    if (user.role === 'SUPPLIER') {
      const assignedSuppliers = rfq.assignedSuppliers ? JSON.parse(rfq.assignedSuppliers) : [];
      if (!assignedSuppliers.includes(user.id) && rfq.status !== 'SUBMITTED') {
        return forbiddenResponse();
      }
    }

    return successResponse({ rfq });
  } catch (error) {
    console.error('Get RFQ error:', error);
    return errorResponse('Failed to get RFQ', 500);
  }
}

// Update RFQ
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return unauthorizedResponse();
    }

    const { id } = await params;

    const rfq = await db.rFQRequest.findUnique({
      where: { id },
      include: { lineItems: true },
    });

    if (!rfq) {
      return notFoundResponse('RFQ');
    }

    // Check access - only client owner or admin can edit
    if (user.role === 'CLIENT' && rfq.clientId !== user.id) {
      return forbiddenResponse();
    }

    // Check if RFQ can be edited
    if (rfq.status === 'COMPLETED' || rfq.status === 'CANCELLED') {
      return errorResponse('Cannot edit a completed or cancelled RFQ', 400);
    }

    const body = await request.json();

    // Handle status update
    if (body.action === 'cancel') {
      const updatedRfq = await db.rFQRequest.update({
        where: { id },
        data: { status: 'CANCELLED' },
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

      return successResponse({ rfq: updatedRfq }, 'RFQ cancelled successfully');
    }

    if (body.action === 'submit') {
      const updatedRfq = await db.rFQRequest.update({
        where: { id },
        data: { status: 'SUBMITTED' },
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

      return successResponse({ rfq: updatedRfq }, 'RFQ submitted successfully');
    }

    if (body.action === 'assign') {
      if (user.role !== 'ADMIN') {
        return forbiddenResponse();
      }

      const updatedRfq = await db.rFQRequest.update({
        where: { id },
        data: {
          assignedSuppliers: body.suppliers ? JSON.stringify(body.suppliers) : null,
          status: 'ASSIGNED',
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

      return successResponse({ rfq: updatedRfq }, 'Suppliers assigned successfully');
    }

    // Regular update
    const validationResult = rfqUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const data = validationResult.data;

    // Update RFQ
    const updatedRfq = await db.rFQRequest.update({
      where: { id },
      data: {
        requestType: data.requestType,
        title: data.title,
        description: data.description,
        category: data.category,
        budget: data.budget || null,
        currency: data.currency,
        deadlineDate: data.deadlineDate ? new Date(data.deadlineDate) : null,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
        deliveryTerms: data.deliveryTerms || null,
        deliveryAddress: data.deliveryAddress || null,
        notes: data.notes || null,
        internalNotes: data.internalNotes || null,
        attachments: body.attachments !== undefined ? (body.attachments ? JSON.stringify(body.attachments) : null) : undefined,
        assignedSuppliers: data.assignedSuppliers ? JSON.stringify(data.assignedSuppliers) : undefined,
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

    // Update line items if provided
    if (data.lineItems && data.lineItems.length > 0) {
      // Delete existing line items
      await db.rFQItem.deleteMany({
        where: { rfqId: id },
      });

      // Create new line items
      await db.rFQItem.createMany({
        data: data.lineItems.map((item, index) => ({
          rfqId: id,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit || null,
          specifications: item.specifications || null,
          link: item.link || null,
          imageUrl: item.imageUrl || null,
          sortOrder: index,
        })),
      });

      // Fetch updated RFQ with line items
      const rfqWithItems = await db.rFQRequest.findUnique({
        where: { id },
        include: {
          lineItems: { orderBy: { sortOrder: 'asc' } },
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

      return successResponse({ rfq: rfqWithItems }, 'RFQ updated successfully');
    }

    return successResponse({ rfq: updatedRfq }, 'RFQ updated successfully');
  } catch (error) {
    console.error('Update RFQ error:', error);
    return errorResponse('Failed to update RFQ', 500);
  }
}

// Delete RFQ
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return unauthorizedResponse();
    }

    const { id } = await params;

    const rfq = await db.rFQRequest.findUnique({
      where: { id },
    });

    if (!rfq) {
      return notFoundResponse('RFQ');
    }

    // Only client owner or admin can delete
    if (user.role === 'CLIENT' && rfq.clientId !== user.id) {
      return forbiddenResponse();
    }

    // Can only delete draft RFQs
    if (rfq.status !== 'DRAFT') {
      return errorResponse('Can only delete draft RFQs', 400);
    }

    await db.rFQRequest.delete({
      where: { id },
    });

    return successResponse(null, 'RFQ deleted successfully');
  } catch (error) {
    console.error('Delete RFQ error:', error);
    return errorResponse('Failed to delete RFQ', 500);
  }
}
