import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prisma: PrismaClient;

if (globalForPrisma.prisma) {
  prisma = globalForPrisma.prisma;
} else {
  // Use connection string without pgbouncer
  // The user might still have pgbouncer=true in their env during the transition,
  // so we strip it out if it exists since the serverless driver connects directly.
  let dbUrl = process.env.DATABASE_URL || "";
  dbUrl = dbUrl.replace("?pgbouncer=true&sslmode=require", "?sslmode=require");
  dbUrl = dbUrl.replace("&pgbouncer=true", "");
  
  const pool = new Pool({ connectionString: dbUrl });
  const adapter = new PrismaNeon(pool);
  
  prisma = new PrismaClient({ adapter, log: ["query"] });
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export { prisma };
