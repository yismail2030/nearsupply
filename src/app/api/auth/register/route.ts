import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { registerSchema } from '@/lib/validators/auth';
import { hashPassword, createSession } from '@/lib/utils/auth';
import { successResponse, errorResponse, validationErrorResponse } from '@/lib/utils/response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validationResult = registerSchema.safeParse(body);
    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const data = validationResult.data;

    // Check if email already exists
    const existingUser = await db.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existingUser) {
      return errorResponse('An account with this email already exists.', 400);
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Create user
    const user = await db.user.create({
      data: {
        email: data.email.toLowerCase(),
        password: hashedPassword,
        name: data.name,
        phone: data.phone || null,
        company: data.company || null,
        address: data.address || null,
        city: data.city || null,
        country: data.country || null,
        website: data.website || null,
        description: data.description || null,
        role: data.role,
      },
    });

    // Create session
    await createSession(user);

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return successResponse({ user: userWithoutPassword }, 'Registration successful');
  } catch (error) {
    console.error('Registration error:', error);
    return errorResponse('An error occurred during registration. Please try again.', 500);
  }
}
