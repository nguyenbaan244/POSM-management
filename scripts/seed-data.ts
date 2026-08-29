import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const data = [
    { account: "Danone", sku: "Cesar1-380g Combo1/2", descr: "Cesar 1 - 380g - Tem Tron (194402)" },
    { account: "Danone", sku: "Cesar1-380g Combo2/2", descr: "Cesar 1 - 380g - Tem Vuong (194402)" },
    { account: "Danone", sku: "Cesar1-800g", descr: "Cesar 1 - 800g (194403)" },
    { account: "Danone", sku: "Cesar2-800g", descr: "Cesar 2 - 800g (194404)" },
    { account: "Danone", sku: "Cesar3-800g", descr: "Cesar 3 - 800g (194405)" },
    { account: "Danone", sku: "Cesar4-800g", descr: "Cesar 4 - 800g ( 210867)" }
  ]

  for (const item of data) {
    await prisma.masterData.upsert({
      where: { sku_account: { sku: item.sku, account: item.account } },
      update: { descr: item.descr },
      create: { account: item.account, sku: item.sku, descr: item.descr }
    })
    console.log(`Upserted ${item.sku}`)
  }

  console.log("Finished seeding data")
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
