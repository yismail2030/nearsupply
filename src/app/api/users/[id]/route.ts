import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, hashPassword } from '@/lib/utils/auth';
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse, validationErrorResponse } from '@/lib/utils/response';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// User update schema
const userUpdateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  email: z.string().email('Invalid email address').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  role: z.enum(['ADMIN', 'SUPPLIER', 'CLIENT']).optional(),
  isActive: z.boolean().optional(),
});

// Update user status (admin only)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return unauthorizedResponse();
    }

    if (user.role !== 'ADMIN') {
      return forbiddenResponse();
    }

    const { id } = await params;
    const body = await request.json();

    // Check if user exists
    const targetUser = await db.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return notFoundResponse('User');
    }

    // Prevent admin from deactivating themselves
    if (id === user.id && body.isActive === false) {
      return errorResponse('Cannot deactivate your own account', 400);
    }

    // Update user
    const updatedUser = await db.user.update({
      where: { id },
      data: {
        isActive: body.isActive,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        company: true,
        createdAt: true,
      },
    });

    return successResponse({ user: updatedUser }, `User ${body.isActive ? 'activated' : 'deactivated'} successfully`);
  } catch (error) {
    console.error('Update user error:', error);
    return errorResponse('Failed to update user', 500);
  }
}

// Update user (admin only)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return unauthorizedResponse();
    }

    if (user.role !== 'ADMIN') {
      return forbiddenResponse();
    }

    const { id } = await params;
    const body = await request.json();

    // Validate input
    const validationResult = userUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const data = validationResult.data;

    // Check if user exists
    const targetUser = await db.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return notFoundResponse('User');
    }

    // Check if email is being changed and if it already exists
    if (data.email && data.email.toLowerCase() !== targetUser.email) {
      const existingUser = await db.user.findUnique({
        where: { email: data.email.toLowerCase() },
      });
      if (existingUser) {
        return errorResponse('Email already in use', 400);
      }
    }

    // Prevent admin from deactivating themselves
    if (id === user.id && data.isActive === false) {
      return errorResponse('Cannot deactivate your own account', 400);
    }

    // Prevent admin from changing their own role
    if (id === user.id && data.role && data.role !== user.role) {
      return errorResponse('Cannot change your own role', 400);
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    
    if (data.name) updateData.name = data.name;
    if (data.email) updateData.email = data.email.toLowerCase();
    if (data.password) updateData.password = await hashPassword(data.password);
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.company !== undefined) updateData.company = data.company;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.country !== undefined) updateData.country = data.country;
    if (data.website !== undefined) updateData.website = data.website;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.role) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    // Update user
    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        company: true,
        phone: true,
        address: true,
        city: true,
        country: true,
        website: true,
        description: true,
        logo: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return successResponse({ user: updatedUser }, 'User updated successfully');
  } catch (error) {
    console.error('Update user error:', error);
    return errorResponse('Failed to update user', 500);
  }
}

// Get single user (admin only)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return unauthorizedResponse();
    }

    if (user.role !== 'ADMIN') {
      return forbiddenResponse();
    }

    const { id } = await params;

    const targetUser = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        company: true,
        phone: true,
        address: true,
        city: true,
        country: true,
        website: true,
        description: true,
        logo: true,
        createdAt: true,
        updatedAt: true,
        products: user.role === 'ADMIN' ? {
          select: { id: true, name: true, status: true },
          take: 10,
        } : false,
        rfqsAsClient: user.role === 'ADMIN' ? {
          select: { id: true, title: true, status: true },
          take: 10,
        } : false,
        proposals: user.role === 'ADMIN' ? {
          select: { id: true, proposalNumber: true, status: true },
          take: 10,
        } : false,
      },
    });

    if (!targetUser) {
      return notFoundResponse('User');
    }

    return successResponse({ user: targetUser });
  } catch (error) {
    console.error('Get user error:', error);
    return errorResponse('Failed to get user', 500);
  }
}
