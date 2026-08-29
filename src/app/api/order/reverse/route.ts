import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/logger";

import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("sessionId")?.value;
    if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true }
    });
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can reverse orders" }, { status: 403 });
    }

    const { orderCode } = await request.json();

    if (!orderCode) {
      return NextResponse.json({ error: "Order code is required" }, { status: 400 });
    }

    if (orderCode.startsWith("IB_")) {
      const items = await prisma.inbound.findMany({ where: { orderCode } });
      if (items.length === 0) return NextResponse.json({ error: "Order not found" }, { status: 404 });
      if (items[0].reversed) return NextResponse.json({ error: "Order already reversed" }, { status: 400 });

      await prisma.$transaction(async (tx) => {
        for (const item of items) {
          const inventory = await tx.inventory.findUnique({
            where: { sku_account: { sku: item.sku, account: item.account } }
          });

          if (!inventory || inventory.quantity < item.quantity) {
            throw new Error(`Cannot reverse Inbound. Not enough stock for SKU ${item.sku} in Account ${item.account}.`);
          }

          await tx.inventory.update({
            where: { sku_account: { sku: item.sku, account: item.account } },
            data: { quantity: { decrement: item.quantity } }
          });

          await tx.inbound.update({
            where: { id: item.id },
            data: { reversed: true }
          });
        }
      });
      
      await logAction("REVERSE_ORDER", `Reversed inbound order ${orderCode}`);
      return NextResponse.json({ success: true, message: "Inbound order reversed successfully" });

    } else if (orderCode.startsWith("OB_")) {
      const items = await prisma.outbound.findMany({ where: { orderCode } });
      if (items.length === 0) return NextResponse.json({ error: "Order not found" }, { status: 404 });
      if (items[0].reversed) return NextResponse.json({ error: "Order already reversed" }, { status: 400 });

      await prisma.$transaction(async (tx) => {
        for (const item of items) {
          await tx.inventory.update({
            where: { sku_account: { sku: item.sku, account: item.account } },
            data: { quantity: { increment: item.quantity } }
          });

          await tx.outbound.update({
            where: { id: item.id },
            data: { reversed: true }
          });
        }
      });
      
      await logAction("REVERSE_ORDER", `Reversed outbound order ${orderCode}`);
      return NextResponse.json({ success: true, message: "Outbound order reversed successfully" });
      
    } else {
      return NextResponse.json({ error: "Invalid order code type (must be IB_ or OB_)" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Reverse Order Error:", error);
    return NextResponse.json({ error: error.message || "Failed to reverse order" }, { status: 500 });
  }
}
