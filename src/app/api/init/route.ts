import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/utils/auth';
import { successResponse, errorResponse } from '@/lib/utils/response';

// Initialize default users - can be called after deployment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const secretKey = body.secretKey;
    
    // Simple protection - in production, require secret key or empty database
    const adminCount = await db.user.count({ where: { role: 'ADMIN' } });
    if (adminCount > 0) {
      return successResponse({
        message: 'Database already initialized',
        alreadyInitialized: true,
        counts: {
          admins: adminCount,
          suppliers: await db.user.count({ where: { role: 'SUPPLIER' } }),
          clients: await db.user.count({ where: { role: 'CLIENT' } }),
        },
      });
    }

    const results = {
      admin: false,
      supplier: false,
      client: false,
    };

    // Create admin
    const hashedAdminPassword = await hashPassword('admin123');
    await db.user.create({
      data: {
        email: 'admin@nearsupply.com',
        password: hashedAdminPassword,
        name: 'Admin User',
        role: 'ADMIN',
        company: 'NearSupply',
        isActive: true,
      },
    });
    results.admin = true;

    // Create supplier
    const hashedSupplierPassword = await hashPassword('supplier123');
    const supplier = await db.user.create({
      data: {
        email: 'supplier@example.com',
        password: hashedSupplierPassword,
        name: 'John Smith',
        role: 'SUPPLIER',
        company: 'ABC Supplies Ltd',
        phone: '+1 555 123 4567',
        address: '123 Industrial Ave',
        city: 'New York',
        country: 'USA',
        website: 'https://abcsupplies.example.com',
        description: 'Leading supplier of industrial equipment and materials.',
        isActive: true,
      },
    });
    results.supplier = true;

    // Create client
    const hashedClientPassword = await hashPassword('client123');
    await db.user.create({
      data: {
        email: 'client@example.com',
        password: hashedClientPassword,
        name: 'Jane Doe',
        role: 'CLIENT',
        company: 'XYZ Corp',
        phone: '+1 555 987 6543',
        address: '456 Business Park',
        city: 'Los Angeles',
        country: 'USA',
        isActive: true,
      },
    });
    results.client = true;

    // Create sample products
    await db.product.createMany({
      data: [
        {
          id: 'prod-001',
          name: 'Industrial Drill Press',
          description: 'Heavy-duty drill press for industrial applications. Variable speed, cast iron base.',
          category: 'Machinery',
          sku: 'IDP-500',
          unitPrice: 2500.00,
          currency: 'USD',
          minimumOrderQuantity: 1,
          unit: 'Piece',
          isFeatured: true,
          status: 'ACTIVE',
          supplierId: supplier.id,
        },
        {
          id: 'prod-002',
          name: 'Steel Pipes (Schedule 40)',
          description: 'Standard steel pipes for construction and industrial use. Various sizes available.',
          category: 'Raw Materials',
          sku: 'SP-S40',
          unitPrice: 45.00,
          currency: 'USD',
          minimumOrderQuantity: 10,
          unit: 'Meter',
          isFeatured: false,
          status: 'ACTIVE',
          supplierId: supplier.id,
        },
      ],
      skipDuplicates: true,
    });

    return successResponse({
      message: 'Database initialized successfully',
      created: results,
      credentials: {
        admin: 'admin@nearsupply.com / admin123',
        supplier: 'supplier@example.com / supplier123',
        client: 'client@example.com / client123',
      },
    });
  } catch (error) {
    console.error('Initialization error:', error);
    return errorResponse('Failed to initialize database', 500);
  }
}

// GET endpoint to check initialization status
export async function GET() {
  try {
    const adminCount = await db.user.count({ where: { role: 'ADMIN' } });
    const supplierCount = await db.user.count({ where: { role: 'SUPPLIER' } });
    const clientCount = await db.user.count({ where: { role: 'CLIENT' } });

    return successResponse({
      initialized: adminCount > 0,
      counts: {
        admins: adminCount,
        suppliers: supplierCount,
        clients: clientCount,
      },
    });
  } catch (error) {
    console.error('Check initialization error:', error);
    return errorResponse('Failed to check initialization status', 500);
  }
}
