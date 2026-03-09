import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/utils/auth';
import { proposalAdminUpdateSchema } from '@/lib/validators/rfq';
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse, validationErrorResponse } from '@/lib/utils/response';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Get single proposal
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return unauthorizedResponse();
    }

    const { id } = await params;

    const proposal = await db.proposal.findUnique({
      where: { id },
      include: {
        rfq: {
          include: {
            lineItems: { orderBy: { sortOrder: 'asc' } },
            client: {
              select: {
                id: true,
                name: true,
                company: true,
                email: true,
                phone: true,
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
            phone: true,
            logo: true,
          },
        },
      },
    });

    if (!proposal) {
      return notFoundResponse('Proposal');
    }

    // Check access
    if (user.role === 'SUPPLIER' && proposal.supplierId !== user.id) {
      return forbiddenResponse();
    }

    if (user.role === 'CLIENT') {
      // Clients can only see shared proposals
      if (!proposal.isShared) {
        return forbiddenResponse();
      }
    }

    return successResponse({ proposal });
  } catch (error) {
    console.error('Get proposal error:', error);
    return errorResponse('Failed to get proposal', 500);
  }
}

// Update proposal
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return unauthorizedResponse();
    }

    const { id } = await params;

    const proposal = await db.proposal.findUnique({
      where: { id },
    });

    if (!proposal) {
      return notFoundResponse('Proposal');
    }

    const body = await request.json();

    // Handle share action (admin only)
    if (body.action === 'share') {
      if (user.role !== 'ADMIN') {
        return forbiddenResponse();
      }

      const updatedProposal = await db.proposal.update({
        where: { id },
        data: {
          isShared: true,
          sharedAt: new Date(),
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
              logo: true,
            },
          },
        },
      });

      return successResponse({ proposal: updatedProposal }, 'Proposal shared with client');
    }

    // Handle send email action (admin only)
    if (body.action === 'send-email') {
      if (user.role !== 'ADMIN') {
        return forbiddenResponse();
      }

      // Get client email
      const rfqWithClient = await db.rFQRequest.findUnique({
        where: { id: proposal.rfqId },
        include: {
          client: {
            select: { email: true, name: true, id: true },
          },
        },
      });

      if (!rfqWithClient) {
        return errorResponse('RFQ not found', 404);
      }

      // Update proposal with email sent info
      const updatedProposal = await db.proposal.update({
        where: { id },
        data: {
          emailSentAt: new Date(),
          emailSentTo: rfqWithClient.client.email,
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
              logo: true,
            },
          },
        },
      });

      // Create notification for client
      await db.notification.create({
        data: {
          userId: rfqWithClient.client.id,
          title: 'New Quote Received',
          message: `A quote has been sent for RFQ ${rfqWithClient.requestNumber}`,
          type: 'quote',
          link: `/proposals/${id}`,
        },
      });

      // In a real app, you would send an email here
      // For now, we just record that email was sent

      return successResponse({ proposal: updatedProposal }, 'Quote sent by email');
    }

    // Handle status update
    if (body.action === 'accept' || body.action === 'reject') {
      if (user.role !== 'ADMIN' && user.role !== 'CLIENT') {
        return forbiddenResponse();
      }

      const updatedProposal = await db.proposal.update({
        where: { id },
        data: {
          status: body.action === 'accept' ? 'ACCEPTED' : 'REJECTED',
        },
        include: {
          rfq: true,
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

      // Update RFQ status if proposal accepted
      if (body.action === 'accept') {
        await db.rFQRequest.update({
          where: { id: proposal.rfqId },
          data: { status: 'COMPLETED' },
        });

        // Notify supplier
        await db.notification.create({
          data: {
            userId: proposal.supplierId,
            title: 'Proposal Accepted',
            message: `Your proposal for RFQ ${updatedProposal.rfq.requestNumber} has been accepted!`,
            type: 'success',
            link: `/proposals/${id}`,
          },
        });
      }

      return successResponse({ proposal: updatedProposal }, `Proposal ${body.action}ed`);
    }

    // Supplier update (own proposal)
    if (user.role === 'SUPPLIER' && proposal.supplierId === user.id) {
      const updatedProposal = await db.proposal.update({
        where: { id },
        data: {
          lineItems: body.lineItems ? JSON.stringify(body.lineItems) : undefined,
          subtotal: body.subtotal,
          grandTotal: body.subtotal, // Reset to subtotal until admin updates
          notes: body.notes,
          deliveryTerms: body.deliveryTerms,
          validity: body.validity,
          attachments: body.attachments ? JSON.stringify(body.attachments) : undefined,
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

      return successResponse({ proposal: updatedProposal }, 'Proposal updated successfully');
    }

    // Admin update (can edit all fields)
    if (user.role === 'ADMIN') {
      const validationResult = proposalAdminUpdateSchema.safeParse(body);
      if (!validationResult.success) {
        return validationErrorResponse(validationResult.error);
      }

      const data = validationResult.data;

      // Calculate grand total if subtotal changed
      let grandTotal = proposal.grandTotal;
      if (data.subtotal !== undefined || data.shippingCost !== undefined || data.taxAmount !== undefined) {
        const subtotal = data.subtotal ?? proposal.subtotal;
        const shippingCost = data.shippingCost ?? proposal.shippingCost;
        const taxAmount = data.taxAmount ?? proposal.taxAmount;
        grandTotal = subtotal + shippingCost + taxAmount;
      }

      const updatedProposal = await db.proposal.update({
        where: { id },
        data: {
          lineItems: data.lineItems ? JSON.stringify(data.lineItems) : undefined,
          subtotal: data.subtotal,
          adminMargin: data.adminMargin,
          shippingCost: data.shippingCost,
          taxPercentage: data.taxPercentage,
          taxAmount: data.taxAmount,
          grandTotal,
          termsConditions: data.termsConditions,
          notes: data.notes,
          deliveryTerms: data.deliveryTerms,
          validity: data.validity,
          attachments: body.attachments ? JSON.stringify(body.attachments) : undefined,
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
              logo: true,
            },
          },
        },
      });

      return successResponse({ proposal: updatedProposal }, 'Proposal updated successfully');
    }

    return forbiddenResponse();
  } catch (error) {
    console.error('Update proposal error:', error);
    return errorResponse('Failed to update proposal', 500);
  }
}
