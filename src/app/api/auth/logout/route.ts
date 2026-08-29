import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const sessionId = request.headers.get("cookie")?.split("; ").find(c => c.startsWith("sessionId="))?.split("=")[1];
  
  if (sessionId) {
    try {
      await prisma.session.delete({ where: { id: sessionId } });
    } catch (e) {
      // Ignore error if session doesn't exist
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete("sessionId");
  return response;
}
