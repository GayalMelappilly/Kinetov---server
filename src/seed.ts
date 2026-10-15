import bcrypt from 'bcryptjs';
import prisma from './prisma';

async function seed() {
  console.log('🌱 Starting database seed for Custom Battery Store...');

  // 1. Seed Admin
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'adminpassword123';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.admin.upsert({
    where: { username: adminUsername },
    update: { password: hashedPassword },
    create: {
      username: adminUsername,
      password: hashedPassword,
      name: 'Master Admin',
    },
  });

  console.log(`✅ Admin user seeded: ${admin.username}`);

  // 2. Seed Initial Products (A few high quality custom battery items)
  const initialProducts = [
    {
      name: 'VoltCraft 48V 100Ah LiFePO4 Solar & Power Pack',
      slug: 'voltcraft-48v-100ah-lifepo4-pack',
      description: 'Engineered for off-grid solar storage, backup power, and heavy-duty energy needs. Built with grade-A prismatic LiFePO4 cells, integrated 150A Smart BMS with Bluetooth monitoring, heavy-duty copper busbars, and a laser-welded IP65 aluminum casing.',
      price: 129990,
      compareAtPrice: 149990,
      voltage: '48.0V (51.2V Nominal)',
      capacity: '100Ah (5.12 kWh)',
      chemistry: 'LiFePO4 (Lithium Iron Phosphate)',
      maxDischarge: '150A Continuous / 300A Peak (5s)',
      cycleLife: '6000+ Cycles @ 80% DOD',
      dimensions: '440 x 400 x 220 mm',
      weight: '42.0 kg',
      connectorType: 'Heavy-Duty M8 Copper Terminals & Anderson SB175',
      category: 'Solar & Home Energy Storage',
      stock: 8,
      isFeatured: true,
      images: [
        'https://images.unsplash.com/photo-1619725002198-6a689b72f41d?auto=format&fit=crop&q=80&w=1000',
        'https://images.unsplash.com/photo-1558441719-6705166e440f?auto=format&fit=crop&q=80&w=1000',
        'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&q=80&w=1000',
      ],
    },
    {
      name: 'HyperPulse 72V 45Ah High-C EV & E-Bike Pack',
      slug: 'hyperpulse-72v-45ah-ev-pack',
      description: 'Ultra-compact high-discharge custom battery pack crafted with Molicel P42A 21700 cells. Designed specifically for custom electric motorbikes, high-speed scooters, and performance EV conversions requiring maximum instantaneous current.',
      price: 74990,
      compareAtPrice: 82990,
      voltage: '72V (84V Max Charge)',
      capacity: '45Ah (3.24 kWh)',
      chemistry: 'Lithium-Ion (NMC High-Drain 21700)',
      maxDischarge: '200A Continuous / 350A Burst',
      cycleLife: '1500+ Cycles @ 80% DOD',
      dimensions: '310 x 210 x 165 mm',
      weight: '16.8 kg',
      connectorType: 'QS8 Anti-Spark Heavy Connector',
      category: 'EV & Electric Bikes',
      stock: 5,
      isFeatured: true,
      images: [
        'https://images.unsplash.com/photo-1558441719-6705166e440f?auto=format&fit=crop&q=80&w=1000',
        'https://images.unsplash.com/photo-1619725002198-6a689b72f41d?auto=format&fit=crop&q=80&w=1000',
      ],
    },
    {
      name: 'AeroMax 24V 20Ah Custom Drone & Robotics LiPo',
      slug: 'aeromax-24v-20ah-drone-lipo',
      description: 'Custom lightweight, high-energy-density 6S (22.2V - 25.2V) lithium polymer battery pack engineered for agricultural payload drones, delivery UAVs, and heavy robotics. Custom copper wiring harness and thermal management insulation.',
      price: 28990,
      compareAtPrice: 32000,
      voltage: '24V (6S 22.2V Nominal)',
      capacity: '20Ah (444 Wh)',
      chemistry: 'LiPo (High Discharge Polymer)',
      maxDischarge: '60C Continuous / 120C Burst',
      cycleLife: '800+ Cycles',
      dimensions: '190 x 95 x 85 mm',
      weight: '2.9 kg',
      connectorType: 'XT90-S Anti-Spark',
      category: 'Drone & Robotics',
      stock: 12,
      isFeatured: true,
      images: [
        'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&q=80&w=1000',
        'https://images.unsplash.com/photo-1619725002198-6a689b72f41d?auto=format&fit=crop&q=80&w=1000',
      ],
    },
    {
      name: 'ApexMarine 12V 200Ah Deep Cycle LiFePO4 Battery',
      slug: 'apexmarine-12v-200ah-marine-pack',
      description: 'Rugged marine & RV custom battery with internal heating elements for sub-zero charging. Waterproof IP67 sealed casing, stainless steel terminal posts, active cell balancer, and NMEA 2000 CANbus telemetry interface.',
      price: 98990,
      compareAtPrice: 110000,
      voltage: '12.8V Nominal',
      capacity: '200Ah (2.56 kWh)',
      chemistry: 'LiFePO4 (Lithium Iron Phosphate)',
      maxDischarge: '200A Continuous',
      cycleLife: '5000+ Cycles',
      dimensions: '520 x 240 x 220 mm',
      weight: '23.5 kg',
      connectorType: 'M8 Stainless Steel Posts & Anderson SB50',
      category: 'Marine & RV Power',
      stock: 6,
      isFeatured: false,
      images: [
        'https://images.unsplash.com/photo-1619725002198-6a689b72f41d?auto=format&fit=crop&q=80&w=1000',
        'https://images.unsplash.com/photo-1558441719-6705166e440f?auto=format&fit=crop&q=80&w=1000',
      ],
    },
  ];

  for (const prod of initialProducts) {
    await prisma.product.upsert({
      where: { slug: prod.slug },
      update: prod,
      create: prod,
    });
  }

  console.log('✅ Seeded 4 custom battery products successfully!');
}

seed()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
