import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/utils/auth';
import { productSchema } from '@/lib/validators/product';
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse, validationErrorResponse } from '@/lib/utils/response';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Get single product
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return unauthorizedResponse();
    }

    const { id } = await params;

    const product = await db.product.findUnique({
      where: { id },
      include: {
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

    if (!product) {
      return notFoundResponse('Product');
    }

    // Check access
    if (user.role !== 'ADMIN' && product.supplierId !== user.id) {
      return forbiddenResponse();
    }

    return successResponse({ product });
  } catch (error) {
    console.error('Get product error:', error);
    return errorResponse('Failed to get product', 500);
  }
}

// Update product
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return unauthorizedResponse();
    }

    const { id } = await params;

    const product = await db.product.findUnique({
      where: { id },
    });

    if (!product) {
      return notFoundResponse('Product');
    }

    // Check access
    if (user.role !== 'ADMIN' && product.supplierId !== user.id) {
      return forbiddenResponse();
    }

    const body = await request.json();
    
    // Validate input
    const validationResult = productSchema.safeParse(body);
    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const data = validationResult.data;

    // Update product
    const updatedProduct = await db.product.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description || null,
        category: data.category,
        sku: data.sku || null,
        unitPrice: data.unitPrice || null,
        currency: data.currency,
        minimumOrderQuantity: data.minimumOrderQuantity || null,
        unit: data.unit || null,
        attachments: body.attachments !== undefined ? (body.attachments ? JSON.stringify(body.attachments) : null) : undefined,
        isFeatured: data.isFeatured,
        status: data.status,
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            company: true,
          },
        },
      },
    });

    return successResponse({ product: updatedProduct }, 'Product updated successfully');
  } catch (error) {
    console.error('Update product error:', error);
    return errorResponse('Failed to update product', 500);
  }
}

// Delete product
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return unauthorizedResponse();
    }

    const { id } = await params;

    const product = await db.product.findUnique({
      where: { id },
    });

    if (!product) {
      return notFoundResponse('Product');
    }

    // Check access
    if (user.role !== 'ADMIN' && product.supplierId !== user.id) {
      return forbiddenResponse();
    }

    await db.product.delete({
      where: { id },
    });

    return successResponse(null, 'Product deleted successfully');
  } catch (error) {
    console.error('Delete product error:', error);
    return errorResponse('Failed to delete product', 500);
  }
}
