import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.baselineInventory.count();
  if (count > 0) {
    console.log(`Baseline inventory already has ${count} records.`);
    return;
  }

  console.log('Seeding baseline inventory for 2026-10-01...');
  const baselineDate = new Date("2026-10-01T00:00:00.000Z");

  // Get current inventory batches
  const batches = await prisma.inventoryBatch.findMany();
  // Get inbounds and outbounds
  const inbounds = await prisma.inbound.findMany({ where: { reversed: false } });
  const outbounds = await prisma.outbound.findMany({ where: { reversed: false } });

  // Map movements by [sku__batch]
  const inMap = new Map<string, number>();
  const outMap = new Map<string, number>();

  for (const ib of inbounds) {
    const key = `${ib.sku}__${ib.batch || ""}`;
    inMap.set(key, (inMap.get(key) || 0) + ib.quantity);
  }
  for (const ob of outbounds) {
    const key = `${ob.sku}__${ob.batch || ""}`;
    outMap.set(key, (outMap.get(key) || 0) + ob.quantity);
  }

  // Collect all unique (sku, batch)
  const allKeys = new Set<string>();
  batches.forEach(b => allKeys.add(`${b.sku}__${b.batch}`));
  inbounds.forEach(i => allKeys.add(`${i.sku}__${i.batch || ""}`));
  outbounds.forEach(o => allKeys.add(`${o.sku}__${o.batch || ""}`));

  const batchMap = new Map<string, any>();
  batches.forEach(b => batchMap.set(`${b.sku}__${b.batch}`, b));

  const baselineRecords: any[] = [];
  let totalBaseline = 0;

  for (const k of allKeys) {
    const [sku, batch] = k.split("__");
    const currentQty = batchMap.get(k)?.quantity || 0;
    const descr = batchMap.get(k)?.descr || sku;
    const inQty = inMap.get(k) || 0;
    const outQty = outMap.get(k) || 0;
    const baseQty = Math.max(0, currentQty - inQty + outQty);

    if (baseQty > 0 || currentQty > 0) {
      totalBaseline += baseQty;
      baselineRecords.push({
        date: baselineDate,
        account: "Danone",
        sku,
        descr,
        batch: batch || "Chưa rõ",
        quantity: baseQty
      });
    }
  }

  for (let i = 0; i < baselineRecords.length; i += 50) {
    await prisma.baselineInventory.createMany({
      data: baselineRecords.slice(i, i + 50)
    });
  }

  console.log(`Seeded ${baselineRecords.length} baseline records for 2026-10-01. Total baseline quantity: ${totalBaseline}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
