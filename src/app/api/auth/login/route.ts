import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { loginSchema } from '@/lib/validators/auth';
import { hashPassword, verifyPassword, createSession } from '@/lib/utils/auth';
import { successResponse, errorResponse, validationErrorResponse } from '@/lib/utils/response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validationResult = loginSchema.safeParse(body);
    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const { email, password } = validationResult.data;

    // Find user
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return errorResponse('Invalid email or password', 401);
    }

    // Check if user is active
    if (!user.isActive) {
      return errorResponse('Your account has been deactivated. Please contact support.', 403);
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      return errorResponse('Invalid email or password', 401);
    }

    // Create session
    await createSession(user);

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return successResponse({ user: userWithoutPassword }, 'Login successful');
  } catch (error) {
    console.error('Login error:', error);
    return errorResponse('An error occurred during login. Please try again.', 500);
  }
}
