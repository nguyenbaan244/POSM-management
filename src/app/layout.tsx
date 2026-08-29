import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "POSM Management System",
  description: "Point of Sale Materials Management",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let user = null;
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("sessionId")?.value;
  
  if (sessionId) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true }
    });
    if (session && session.expiresAt > new Date()) {
      user = { name: session.user.name, role: session.user.role };
    }
  }

  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-slate-50 flex overflow-hidden`}>
        <Sidebar user={user} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        <Toaster position="top-center" richColors theme="light" />
      </body>
    </html>
  );
}
