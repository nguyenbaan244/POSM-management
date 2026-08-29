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

    // Generate Order Code: OB_ddmmyyyy_n
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const prefix = `OB_${dd}${mm}${yyyy}_`;

    // Find the latest order code for today to determine n
    const latestOrder = await prisma.outbound.findFirst({
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

    // Use a transaction to ensure both Outbound records and Inventory are updated together
    const result = await prisma.$transaction(async (tx) => {
      const createdItems = [];
      for (const item of items) {
        // 1. Create Outbound record
        const outbound = await tx.outbound.create({
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
        createdItems.push(outbound);

        // 2. Update Inventory (decrement)
        const inventory = await tx.inventory.findUnique({
          where: { sku_account: { sku: item.sku, account: item.account || "Danone" } }
        });

        if (!inventory) {
          throw new Error(`SKU ${item.sku} (Account: ${item.account || "Danone"}) not found in inventory.`);
        }

        if (inventory.quantity < Number(item.quantity)) {
          throw new Error(`Not enough stock for SKU ${item.sku}. Available: ${inventory.quantity}`);
        }

        await tx.inventory.update({
          where: { sku_account: { sku: item.sku, account: item.account || "Danone" } },
          data: {
            quantity: { decrement: Number(item.quantity) },
          }
        });
      }
      return createdItems;
    });

    await logAction("OUTBOUND", `Created outbound order ${orderCode} with ${items.length} items`);

    return NextResponse.json({ success: true, count: result.length, orderCode });
  } catch (error: any) {
    console.error("Outbound Error:", error);
    return NextResponse.json({ error: error.message || "Failed to process outbound items" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const history = await prisma.outbound.findMany({
      orderBy: { id: 'desc' },
      take: 50,
    });
    return NextResponse.json(history);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch outbound history" }, { status: 500 });
  }
}
