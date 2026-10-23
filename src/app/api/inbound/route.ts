import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { logAction } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items } = body;
    
    // Get active user
    let createdBy = "System";
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("sessionId")?.value;
    if (sessionId) {
      const session = await prisma.session.findUnique({ where: { id: sessionId }, include: { user: true }});
      if (session && session.user) createdBy = session.user.name;
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 });
    }

    // Generate Order Code: IB_ddmmyyyy_n
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const prefix = `IB_${dd}${mm}${yyyy}_`;

    // Find the latest order code for today to determine n
    const latestOrder = await prisma.inbound.findFirst({
      where: { orderCode: { startsWith: prefix } },
      orderBy: { id: 'desc' },
    });

    let n = 1;
    if (latestOrder && latestOrder.orderCode) {
      const parts = latestOrder.orderCode.split('_');
      if (parts.length === 3) {
        n = parseInt(parts[2], 10) + 1;
      }
    }
    const orderCode = `${prefix}${n}`;

    // Use a transaction to ensure both Inbound records and Inventory are updated together
    const result = await prisma.$transaction(async (tx) => {
      const createdItems = [];
      for (const item of items) {
        // 1. Create Inbound record
        const inbound = await tx.inbound.create({
          data: {
            orderCode,
            account: item.account || "Danone",
            date: new Date(item.date),
            sku: item.sku,
            descr: item.descr,
            quantity: Number(item.quantity),
            status: item.status,
            remark: item.remark,
            createdBy
          }
        });
        createdItems.push(inbound);

        // 2. Update Inventory
        await tx.inventory.upsert({
          where: { 
            sku_account: { sku: item.sku, account: item.account || "Danone" }
          },
          update: {
            quantity: { increment: Number(item.quantity) },
            descr: item.descr 
          },
          create: {
            sku: item.sku,
            account: item.account || "Danone",
            descr: item.descr,
            quantity: Number(item.quantity),
          }
        });
      }
      return createdItems;
    });

    await logAction("INBOUND", `Created inbound order ${orderCode} with ${items.length} items`);

    return NextResponse.json({ success: true, count: result.length, orderCode });
  } catch (error) {
    console.error("Inbound Error:", error);
    return NextResponse.json({ error: "Failed to process inbound items" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month"); // e.g. "2026-10"
    const selectedDate = searchParams.get("date"); // e.g. "2026-10-23"
    const sku = searchParams.get("sku");
    const search = searchParams.get("search");

    let whereClause: any = { reversed: false };

    if (selectedDate && selectedDate !== "all") {
      const start = new Date(selectedDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(selectedDate);
      end.setHours(23, 59, 59, 999);
      whereClause.date = { gte: start, lte: end };
    } else if (month && month !== "all") {
      const [y, m] = month.split('-').map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59, 999);
      whereClause.date = { gte: start, lte: end };
    }

    if (sku && sku !== "all") {
      whereClause.sku = sku;
    }

    if (search) {
      whereClause.OR = [
        { sku: { contains: search, mode: 'insensitive' } },
        { descr: { contains: search, mode: 'insensitive' } },
        { orderCode: { contains: search, mode: 'insensitive' } },
        { remark: { contains: search, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.inbound.findMany({
      where: whereClause,
      orderBy: { date: 'desc' }
    });

    // Compute stats
    let totalQuantity = 0;
    const dailyMap: Record<string, number> = {};
    const skuMap: Record<string, { sku: string, descr: string, quantity: number, count: number }> = {};

    items.forEach(item => {
      totalQuantity += item.quantity;
      const d = item.date.toISOString().split('T')[0];
      dailyMap[d] = (dailyMap[d] || 0) + item.quantity;

      if (!skuMap[item.sku]) {
        skuMap[item.sku] = { sku: item.sku, descr: item.descr, quantity: 0, count: 0 };
      }
      skuMap[item.sku].quantity += item.quantity;
      skuMap[item.sku].count += 1;
    });

    const dailyStats = Object.entries(dailyMap)
      .map(([date, quantity]) => ({ date, quantity }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const skuStats = Object.values(skuMap).sort((a, b) => b.quantity - a.quantity);

    // Get all available dates and months from all inbound data
    const allInbounds = await prisma.inbound.findMany({
      select: { date: true },
      distinct: ['date'],
      orderBy: { date: 'desc' }
    });
    
    const availableDates = Array.from(new Set(allInbounds.map(x => x.date.toISOString().split('T')[0])));
    const availableMonths = Array.from(new Set(availableDates.map(d => d.substring(0, 7))));

    return NextResponse.json({
      items,
      totalQuantity,
      totalCount: items.length,
      dailyStats,
      skuStats,
      availableDates,
      availableMonths
    });
  } catch (error) {
    console.error("Failed to fetch inbound history:", error);
    return NextResponse.json({ error: "Failed to fetch inbound history" }, { status: 500 });
  }
}

