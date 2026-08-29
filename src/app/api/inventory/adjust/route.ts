import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { logAction } from "@/lib/logger";

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
      return NextResponse.json({ error: "Only admins can adjust inventory" }, { status: 403 });
    }

    const createdBy = session.user.name;
    const { sku, account, descr, oldQuantity, newQuantity, reason } = await request.json();

    if (!sku || !account || newQuantity === undefined || !reason) {
      return NextResponse.json({ error: "Missing required fields (sku, account, newQuantity, reason)" }, { status: 400 });
    }

    const diff = Number(newQuantity) - Number(oldQuantity);
    
    if (diff === 0) {
      return NextResponse.json({ success: true, message: "No change in quantity" });
    }

    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const prefix = `ADJ_${dd}${mm}${yyyy}_`;

    let updatedInventory;
    await prisma.$transaction(async (tx) => {
      // 1. Update Inventory
      updatedInventory = await tx.inventory.update({
        where: { sku_account: { sku, account } },
        data: { quantity: Number(newQuantity) }
      });

      // 2. Log Adjustment in Inbound or Outbound depending on diff
      if (diff > 0) {
        // Find latest ADJ for inbound
        const latestOrder = await tx.inbound.findFirst({
          where: { orderCode: { startsWith: prefix } },
          orderBy: { id: 'desc' },
        });
        let n = 1;
        if (latestOrder && latestOrder.orderCode) {
          const parts = latestOrder.orderCode.split('_');
          if (parts.length === 3) n = parseInt(parts[2], 10) + 1;
        }
        
        await tx.inbound.create({
          data: {
            orderCode: `${prefix}${n}`,
            account,
            date: today,
            sku,
            descr,
            quantity: diff,
            status: "Adjustment",
            remark: reason,
            createdBy
          }
        });
      } else {
        // diff < 0
        const latestOrder = await tx.outbound.findFirst({
          where: { orderCode: { startsWith: prefix } },
          orderBy: { id: 'desc' },
        });
        let n = 1;
        if (latestOrder && latestOrder.orderCode) {
          const parts = latestOrder.orderCode.split('_');
          if (parts.length === 3) n = parseInt(parts[2], 10) + 1;
        }

        await tx.outbound.create({
          data: {
            orderCode: `${prefix}${n}`,
            account,
            date: today,
            sku,
            descr,
            quantity: Math.abs(diff),
            status: "Adjustment",
            remark: reason,
            createdBy
          }
        });
      }
    });

    await logAction("INVENTORY_ADJUST", `Adjusted SKU ${sku} (${account}) to ${newQuantity}. Reason: ${reason}`);

    return NextResponse.json({ success: true, updatedInventory });
  } catch (error: any) {
    console.error("Inventory Adjust Error:", error);
    return NextResponse.json({ error: error.message || "Failed to adjust inventory" }, { status: 500 });
  }
}
