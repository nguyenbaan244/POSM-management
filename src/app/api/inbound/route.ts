import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const items = body.items as any[]; // Array of inbound items

    // Use a transaction to ensure both Inbound records and Inventory are updated together
    const result = await prisma.$transaction(async (tx) => {
      const createdItems = [];
      for (const item of items) {
        // 1. Create Inbound record
        const inbound = await tx.inbound.create({
          data: {
            date: new Date(item.date),
            sku: item.sku,
            descr: item.descr,
            quantity: Number(item.quantity),
            status: item.status,
            remark: item.remark,
          }
        });
        createdItems.push(inbound);

        // 2. Update Inventory
        await tx.inventory.upsert({
          where: { sku: item.sku },
          update: {
            quantity: { increment: Number(item.quantity) },
            descr: item.descr // Update descr just in case
          },
          create: {
            sku: item.sku,
            descr: item.descr,
            quantity: Number(item.quantity),
          }
        });
      }
      return createdItems;
    });

    return NextResponse.json({ success: true, count: result.length });
  } catch (error) {
    console.error("Inbound Error:", error);
    return NextResponse.json({ error: "Failed to process inbound items" }, { status: 500 });
  }
}
