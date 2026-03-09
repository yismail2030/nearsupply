import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/utils/auth';
import { profileUpdateSchema, passwordChangeSchema } from '@/lib/validators/auth';
import { verifyPassword, hashPassword } from '@/lib/utils/auth';
import { successResponse, errorResponse, unauthorizedResponse, validationErrorResponse } from '@/lib/utils/response';

// Get profile
export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return unauthorizedResponse();
    }

    const fullUser = await db.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        company: true,
        address: true,
        city: true,
        country: true,
        website: true,
        description: true,
        logo: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!fullUser) {
      return unauthorizedResponse();
    }

    return successResponse({ user: fullUser });
  } catch (error) {
    console.error('Get profile error:', error);
    return errorResponse('Failed to get profile', 500);
  }
}

// Update profile
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    
    // Check if it's a password change
    if (body.currentPassword || body.newPassword) {
      const validationResult = passwordChangeSchema.safeParse(body);
      if (!validationResult.success) {
        return validationErrorResponse(validationResult.error);
      }

      const { currentPassword, newPassword } = validationResult.data;

      // Get current user with password
      const userWithPassword = await db.user.findUnique({
        where: { id: user.id },
        select: { password: true },
      });

      if (!userWithPassword) {
        return unauthorizedResponse();
      }

      // Verify current password
      const isValid = await verifyPassword(currentPassword, userWithPassword.password);
      if (!isValid) {
        return errorResponse('Current password is incorrect', 400);
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update password
      await db.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      return successResponse(null, 'Password updated successfully');
    }

    // Regular profile update
    const validationResult = profileUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const data = validationResult.data;

    // Check if email is being changed and if it's already taken
    if (data.email.toLowerCase() !== user.email.toLowerCase()) {
      const existingUser = await db.user.findUnique({
        where: { email: data.email.toLowerCase() },
      });

      if (existingUser) {
        return errorResponse('This email is already in use', 400);
      }
    }

    // Update profile
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        phone: data.phone || null,
        company: data.company || null,
        address: data.address || null,
        city: data.city || null,
        country: data.country || null,
        website: data.website || null,
        description: data.description || null,
        logo: body.logo !== undefined ? body.logo : undefined,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        company: true,
        address: true,
        city: true,
        country: true,
        website: true,
        description: true,
        logo: true,
        role: true,
      },
    });

    return successResponse({ user: updatedUser }, 'Profile updated successfully');
  } catch (error) {
    console.error('Update profile error:', error);
    return errorResponse('Failed to update profile', 500);
  }
}
