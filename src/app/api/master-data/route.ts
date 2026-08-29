import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get("sku");
    const account = searchParams.get("account");

    if (sku && account) {
      const data = await prisma.masterData.findUnique({
        where: { sku_account: { sku, account } },
      });
      return NextResponse.json(data);
    }

    const whereClause: any = {};
    if (account) whereClause.account = account;

    const data = await prisma.masterData.findMany({
      where: whereClause
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch master data" }, { status: 500 });
  }
}

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
      return NextResponse.json({ error: "Only admins can edit master data" }, { status: 403 });
    }

    const { sku, account, descr } = await request.json();
    const data = await prisma.masterData.upsert({
      where: { sku_account: { sku, account: account || "Danone" } },
      update: { descr },
      create: { sku, account: account || "Danone", descr },
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to save master data" }, { status: 500 });
  }
}
