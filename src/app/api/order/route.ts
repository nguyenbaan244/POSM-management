import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json({ error: "Order code is required" }, { status: 400 });
    }

    let items = [];

    if (code.startsWith("IB_") || code.startsWith("ADJ_")) {
      items = await prisma.inbound.findMany({ where: { orderCode: code } });
      if (items.length === 0 && code.startsWith("ADJ_")) {
        // Adjustment could be in outbound too
        items = await prisma.outbound.findMany({ where: { orderCode: code } });
      }
    } else if (code.startsWith("OB_")) {
      items = await prisma.outbound.findMany({ where: { orderCode: code } });
    } else {
      return NextResponse.json({ error: "Invalid order code format" }, { status: 400 });
    }

    if (items.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // All items should have the same date, reversed status, etc.
    const meta = {
      orderCode: code,
      date: items[0].date,
      reversed: items[0].reversed,
      type: code.startsWith("IB_") ? "Inbound" : code.startsWith("OB_") ? "Outbound" : "Adjustment"
    };

    return NextResponse.json({ meta, items });
  } catch (error: any) {
    console.error("Fetch Order Error:", error);
    return NextResponse.json({ error: "Failed to fetch order details" }, { status: 500 });
  }
}
