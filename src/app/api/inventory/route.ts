import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const withBatches = searchParams.get("batches");

    const [items, batches] = await Promise.all([
      prisma.inventory.findMany({ orderBy: { quantity: "desc" } }),
      prisma.inventoryBatch.findMany({ orderBy: [{ sku: "asc" }, { batch: "asc" }] })
    ]);

    if (withBatches === "true") {
      return NextResponse.json({ items, batches });
    }

    // Default: return array of items for backward compatibility
    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to fetch inventory:", error);
    return NextResponse.json({ error: "Failed to fetch inventory" }, { status: 500 });
  }
}
