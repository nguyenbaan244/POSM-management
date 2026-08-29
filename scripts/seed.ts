import { PrismaClient } from '@prisma/client'
import * as xlsx from 'xlsx'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const prisma = new PrismaClient()

// Hash password with salt
function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

async function main() {
  // 1. Seed Admin User
  const adminExists = await prisma.user.findUnique({ where: { username: 'Phuong' } })
  if (!adminExists) {
    console.log('Seeding admin user...')
    await prisma.user.create({
      data: {
        username: 'Phuong',
        name: 'Phuong',
        role: 'ADMIN',
        passwordHash: hashPassword('12345678')
      }
    })
  } else {
    console.log('Admin user already exists.')
  }

  // 2. Seed Master Data
  const filePath = path.join(process.cwd(), '..', 'Master Data.xlsx')
  console.log('Reading from', filePath)
  
  if (!fs.existsSync(filePath)) {
    console.log('File not found')
    return
  }

  const workbook = xlsx.readFile(filePath)
  const sheetName = workbook.SheetNames[0]
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName])
  
  console.log(`Found ${data.length} rows in Master Data`)
  
  for (const row of data as any[]) {
    const sku = row['SKU'] || row['SKU Code'] || Object.values(row)[0]
    const descr = row['Description'] || Object.values(row)[1]
    const account = "Danone"
    
    if (sku && descr) {
      await prisma.masterData.upsert({
        where: { sku_account: { sku: String(sku), account } },
        update: { descr: String(descr) },
        create: { sku: String(sku), account, descr: String(descr) },
      })
    }
  }
  
  console.log('Seed completed')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
