import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const ibRes = await prisma.$executeRawUnsafe(`
    UPDATE "Inbound"
    SET "batch" = TRIM(SUBSTRING("remark" FROM 'Lô:[[:space:]]*([^|]+)'))
    WHERE ("batch" = '' OR "batch" IS NULL) AND "remark" LIKE '%Lô:%';
  `);
  console.log('Inbound batch updated count:', ibRes);

  const obRes = await prisma.$executeRawUnsafe(`
    UPDATE "Outbound"
    SET "batch" = TRIM(SUBSTRING("remark" FROM 'Lô:[[:space:]]*([^|]+)'))
    WHERE ("batch" = '' OR "batch" IS NULL) AND "remark" LIKE '%Lô:%';
  `);
  console.log('Outbound batch updated count:', obRes);
}

main().catch(console.error).finally(() => prisma.$disconnect());
