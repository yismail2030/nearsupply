import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/utils/auth';
import { productSchema } from '@/lib/validators/product';
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, validationErrorResponse } from '@/lib/utils/response';

// Get products (suppliers see their own, admins see all)
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const featured = searchParams.get('featured');

    const where: Record<string, unknown> = {};

    // Non-admin users can only see their own products
    if (user.role !== 'ADMIN') {
      where.supplierId = user.id;
    }

    if (category) {
      where.category = category;
    }

    if (status) {
      where.status = status;
    }

    if (featured === 'true') {
      where.isFeatured = true;
    }

    const products = await db.product.findMany({
      where,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            company: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse({ products });
  } catch (error) {
    console.error('Get products error:', error);
    return errorResponse('Failed to get products', 500);
  }
}

// Create product (suppliers only)
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
    const validationResult = productSchema.safeParse(body);
    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const data = validationResult.data;

    // Create product
    const product = await db.product.create({
      data: {
        name: data.name,
        description: data.description || null,
        category: data.category,
        sku: data.sku || null,
        unitPrice: data.unitPrice || null,
        currency: data.currency,
        minimumOrderQuantity: data.minimumOrderQuantity || null,
        unit: data.unit || null,
        attachments: body.attachments ? JSON.stringify(body.attachments) : null,
        isFeatured: data.isFeatured,
        status: data.status,
        supplierId: user.id,
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

    return successResponse({ product }, 'Product created successfully');
  } catch (error) {
    console.error('Create product error:', error);
    return errorResponse('Failed to create product', 500);
  }
}
