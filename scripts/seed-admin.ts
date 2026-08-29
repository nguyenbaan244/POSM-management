import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

async function main() {
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
    console.log('Admin user created successfully.')
  } else {
    console.log('Admin user already exists in Neon DB.')
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
