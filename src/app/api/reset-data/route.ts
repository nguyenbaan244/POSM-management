import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const scope = body.scope || "all"; // "all" | "transactions" | "inventory"
    const includeMasterData = Boolean(body.includeMasterData);

    const deletedCounts: Record<string, number> = {};

    if (scope === "all" || scope === "transactions") {
      const delIn = await prisma.inbound.deleteMany({});
      const delOut = await prisma.outbound.deleteMany({});
      deletedCounts["inbound"] = delIn.count;
      deletedCounts["outbound"] = delOut.count;
    }

    if (scope === "all" || scope === "inventory") {
      const delInv = await prisma.inventory.deleteMany({});
      const delBatch = await prisma.inventoryBatch.deleteMany({});
      const delSnap = await prisma.latestInventorySnapshot.deleteMany({});
      const delBase = await prisma.baselineInventory.deleteMany({});
      deletedCounts["inventory"] = delInv.count;
      deletedCounts["inventoryBatch"] = delBatch.count;
      deletedCounts["latestInventorySnapshot"] = delSnap.count;
      deletedCounts["baselineInventory"] = delBase.count;
    }

    if (includeMasterData) {
      const delMaster = await prisma.masterData.deleteMany({});
      deletedCounts["masterData"] = delMaster.count;
    }

    await logAction(
      "RESET_DATA",
      `Đã thực hiện xóa dữ liệu cũ (Scope: ${scope}). Chi tiết: ${JSON.stringify(deletedCounts)}`
    );

    return NextResponse.json({
      success: true,
      scope,
      deletedCounts,
      message: "Đã xóa dữ liệu cũ thành công! Hệ thống đã được làm sạch và sẵn sàng nhận dữ liệu mới."
    });
  } catch (error: any) {
    console.error("Reset data error:", error);
    return NextResponse.json(
      { error: error?.message || "Không thể xóa dữ liệu cũ" },
      { status: 500 }
    );
  }
}
