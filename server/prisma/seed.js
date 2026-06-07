import { PrismaClient } from '@prisma/client';
import dns from 'dns';

// Force Node.js to use Google DNS to bypass local ISP DNS resolution issues
dns.setServers(['8.8.8.8']);


const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create VIT college
  const college = await prisma.college.upsert({
    where: { slug: 'vit' },
    update: {},
    create: {
      name: 'VIT Vellore',
      slug: 'vit',
      domain: 'vit.ac.in',
      isActive: true,
    },
  });

  console.log('✅ Created college:', college.name);

  // Create sample events (skip if events already exist for this college)
  const existingEvents = await prisma.event.count({
    where: { collegeId: college.id },
  });

  if (existingEvents === 0) {
    const events = [
      {
        name: 'Riviera 2026',
        description:
          "VIT's annual international sports and cultural carnival. Three days of music, dance, drama, and athletic competitions bringing together students from across the globe.",
        date: new Date('2026-07-15T10:00:00Z'),
        venue: 'Main Auditorium',
        collegeId: college.id,
      },
      {
        name: 'Freshers Night',
        description:
          'Welcome the batch of 2030! An unforgettable evening of performances, introductions, and celebrations to kick off your VIT journey.',
        date: new Date('2026-08-01T18:00:00Z'),
        venue: 'Open Air Theatre',
        collegeId: college.id,
      },
      {
        name: 'Cultural Fest',
        description:
          'A vibrant celebration of art, music, and culture featuring competitions in dance, singing, painting, and more. Show off your talents!',
        date: new Date('2026-09-20T09:00:00Z'),
        venue: 'Anna Auditorium',
        collegeId: college.id,
      },
      {
        name: 'Tech Summit',
        description:
          'The premier technology conference at VIT featuring keynote speakers from top tech companies, hackathons, workshops, and networking sessions.',
        date: new Date('2026-10-10T09:00:00Z'),
        venue: 'SJT Seminar Hall',
        collegeId: college.id,
      },
    ];

    for (const eventData of events) {
      const event = await prisma.event.create({ data: eventData });
      console.log('✅ Created event:', event.name);
    }
  } else {
    console.log(`ℹ️  ${existingEvents} events already exist, skipping event creation.`);
  }

  console.log('\n🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
