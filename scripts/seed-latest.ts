import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.latestInventorySnapshot.count();
  if (count > 0) {
    console.log(`Latest snapshot already has ${count} records.`);
    return;
  }

  const latestDate = new Date("2026-10-23T00:00:00.000Z");
  const batches = await prisma.inventoryBatch.findMany();

  const records = batches.map(b => ({
    date: latestDate,
    account: "Danone",
    sku: b.sku,
    descr: b.descr,
    batch: b.batch,
    quantity: b.quantity
  }));

  for (let i = 0; i < records.length; i += 50) {
    await prisma.latestInventorySnapshot.createMany({
      data: records.slice(i, i + 50)
    });
  }

  console.log(`Seeded ${records.length} latest snapshot records for 2026-10-23.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
