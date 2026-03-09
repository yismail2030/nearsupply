import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse } from '@/lib/utils/response';

export async function GET(request: NextRequest) {
  try {
    // Check if any admin user exists
    const adminCount = await db.user.count({
      where: { role: 'ADMIN' },
    });

    const totalUsers = await db.user.count();

    return successResponse({
      needsSetup: adminCount === 0,
      hasAdmin: adminCount > 0,
      totalUsers,
      adminCount,
    });
  } catch (error) {
    console.error('Setup check error:', error);
    return successResponse({
      needsSetup: true,
      hasAdmin: false,
      totalUsers: 0,
      adminCount: 0,
    });
  }
}
