import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get("sku");
    if (sku) {
      const data = await prisma.masterData.findUnique({
        where: { sku },
      });
      return NextResponse.json(data);
    }
    const data = await prisma.masterData.findMany();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch master data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sku, descr } = body;
    const data = await prisma.masterData.upsert({
      where: { sku },
      update: { descr },
      create: { sku, descr },
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to save master data" }, { status: 500 });
  }
}
