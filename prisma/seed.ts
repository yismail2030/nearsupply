import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@nearsupply.com' },
    update: {},
    create: {
      email: 'admin@nearsupply.com',
      password: adminPassword,
      name: 'Admin User',
      role: UserRole.ADMIN,
      company: 'NearSupply',
      isActive: true,
    },
  });
  console.log('Created admin user:', admin.email);

  // Create supplier user
  const supplierPassword = await bcrypt.hash('supplier123', 12);
  const supplier = await prisma.user.upsert({
    where: { email: 'supplier@example.com' },
    update: {},
    create: {
      email: 'supplier@example.com',
      password: supplierPassword,
      name: 'John Smith',
      role: UserRole.SUPPLIER,
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
  console.log('Created supplier user:', supplier.email);

  // Create client user
  const clientPassword = await bcrypt.hash('client123', 12);
  const client = await prisma.user.upsert({
    where: { email: 'client@example.com' },
    update: {},
    create: {
      email: 'client@example.com',
      password: clientPassword,
      name: 'Jane Doe',
      role: UserRole.CLIENT,
      company: 'XYZ Corp',
      phone: '+1 555 987 6543',
      address: '456 Business Park',
      city: 'Los Angeles',
      country: 'USA',
      isActive: true,
    },
  });
  console.log('Created client user:', client.email);

  // Create sample products for supplier
  const product1 = await prisma.product.upsert({
    where: { id: 'prod-001' },
    update: {},
    create: {
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
  });
  console.log('Created product:', product1.name);

  const product2 = await prisma.product.upsert({
    where: { id: 'prod-002' },
    update: {},
    create: {
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
  });
  console.log('Created product:', product2.name);

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
