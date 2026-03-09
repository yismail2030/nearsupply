import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, createSession } from '@/lib/utils/auth';
import { successResponse, errorResponse, validationErrorResponse } from '@/lib/utils/response';
import { z } from 'zod';

const setupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  company: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Check if setup is still needed
    const adminCount = await db.user.count({
      where: { role: 'ADMIN' },
    });

    if (adminCount > 0) {
      return errorResponse('Setup has already been completed. Admin user exists.', 400);
    }

    const body = await request.json();
    
    // Validate input
    const validationResult = setupSchema.safeParse(body);
    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const { name, email, password, company } = validationResult.data;

    // Check if email already exists
    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return errorResponse('Email already registered', 400);
    }

    // Create admin user
    const hashedPassword = await hashPassword(password);
    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        company: company || 'NearSupply',
        role: 'ADMIN',
        isActive: true,
      },
    });

    // Create session
    await createSession(user);

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return successResponse({ user: userWithoutPassword }, 'Admin account created successfully');
  } catch (error) {
    console.error('Setup error:', error);
    return errorResponse('An error occurred during setup. Please try again.', 500);
  }
}
