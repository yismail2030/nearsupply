import { clearSession } from '@/lib/utils/auth';
import { successResponse } from '@/lib/utils/response';

export async function POST() {
  try {
    await clearSession();
    return successResponse(null, 'Logout successful');
  } catch (error) {
    console.error('Logout error:', error);
    return successResponse(null, 'Logout successful');
  }
}
