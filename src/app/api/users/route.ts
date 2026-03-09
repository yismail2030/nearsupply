import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, hashPassword } from '@/lib/utils/auth';
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, validationErrorResponse } from '@/lib/utils/response';
import { adminCreateUserSchema, bulkCreateUserSchema } from '@/lib/validators/auth';

// Get users (admin only) - for user management
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return unauthorizedResponse();
    }

    if (user.role !== 'ADMIN') {
      return forbiddenResponse();
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};

    if (role) {
      where.role = role;
    }

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    const users = await db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        company: true,
        role: true,
        logo: true,
        isActive: true,
        phone: true,
        address: true,
        city: true,
        country: true,
        website: true,
        description: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse({ users });
  } catch (error) {
    console.error('Get users error:', error);
    return errorResponse('Failed to get users', 500);
  }
}

// Create user(s) - admin only
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return unauthorizedResponse();
    }

    if (user.role !== 'ADMIN') {
      return forbiddenResponse();
    }

    const body = await request.json();
    
    // Check if it's a bulk creation request
    if (body.users && Array.isArray(body.users)) {
      const validationResult = bulkCreateUserSchema.safeParse(body);
      if (!validationResult.success) {
        return validationErrorResponse(validationResult.error);
      }

      const { users } = validationResult.data;
      const createdUsers: Array<{ id: string; name: string; email: string; role: string }> = [];
      const errors: Array<{ email: string; error: string }> = [];

      for (const userData of users) {
        try {
          // Check if email already exists
          const existing = await db.user.findUnique({
            where: { email: userData.email.toLowerCase() },
          });

          if (existing) {
            errors.push({ email: userData.email, error: 'Email already exists' });
            continue;
          }

          const hashedPassword = await hashPassword(userData.password);
          
          const newUser = await db.user.create({
            data: {
              email: userData.email.toLowerCase(),
              password: hashedPassword,
              name: userData.name,
              phone: userData.phone || null,
              company: userData.company || null,
              address: userData.address || null,
              city: userData.city || null,
              country: userData.country || null,
              website: userData.website || null,
              description: userData.description || null,
              role: userData.role,
              isActive: userData.isActive ?? true,
            },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          });

          createdUsers.push(newUser);
        } catch (err) {
          errors.push({ 
            email: userData.email, 
            error: err instanceof Error ? err.message : 'Failed to create user' 
          });
        }
      }

      return successResponse({ 
        created: createdUsers, 
        errors,
        totalCreated: createdUsers.length,
        totalErrors: errors.length,
      }, `Created ${createdUsers.length} user(s)${errors.length > 0 ? ` with ${errors.length} error(s)` : ''}`);
    }

    // Single user creation
    const validationResult = adminCreateUserSchema.safeParse(body);
    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const data = validationResult.data;

    // Check if email already exists
    const existingUser = await db.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existingUser) {
      return errorResponse('An account with this email already exists', 400);
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Create user
    const newUser = await db.user.create({
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
        isActive: data.isActive,
      },
      select: {
        id: true,
        name: true,
        email: true,
        company: true,
        role: true,
        phone: true,
        address: true,
        city: true,
        country: true,
        website: true,
        description: true,
        isActive: true,
        createdAt: true,
      },
    });

    return successResponse({ user: newUser }, 'User created successfully');
  } catch (error) {
    console.error('Create user error:', error);
    return errorResponse('Failed to create user', 500);
  }
}
