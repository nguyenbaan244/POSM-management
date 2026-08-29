import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const items = body.items as any[]; // Array of outbound items

    // Use a transaction to ensure both Outbound records and Inventory are updated together
    const result = await prisma.$transaction(async (tx) => {
      const createdItems = [];
      for (const item of items) {
        // 1. Create Outbound record
        const outbound = await tx.outbound.create({
          data: {
            date: new Date(item.date),
            sku: item.sku,
            descr: item.descr,
            quantity: Number(item.quantity),
            status: item.status,
            remark: item.remark,
          }
        });
        createdItems.push(outbound);

        // 2. Update Inventory (decrement)
        const inventory = await tx.inventory.findUnique({
          where: { sku: item.sku }
        });

        if (!inventory) {
          throw new Error(`SKU ${item.sku} not found in inventory.`);
        }

        if (inventory.quantity < Number(item.quantity)) {
          throw new Error(`Not enough stock for SKU ${item.sku}. Available: ${inventory.quantity}`);
        }

        await tx.inventory.update({
          where: { sku: item.sku },
          data: {
            quantity: { decrement: Number(item.quantity) },
          }
        });
      }
      return createdItems;
    });

    return NextResponse.json({ success: true, count: result.length });
  } catch (error: any) {
    console.error("Outbound Error:", error);
    return NextResponse.json({ error: error.message || "Failed to process outbound items" }, { status: 500 });
  }
}
