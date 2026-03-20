'use client'
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { AuthProvider } from "@/components/authContext";

const defaultUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `https://${process.env.NEXT_PUBLIC_SUPABASE_URL}`
  : "http://localhost:3000";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={GeistSans.className} suppressHydrationWarning>
      <body className="bg-background text-foreground">
          <div className="">
            <AuthProvider>
              {children}
            </AuthProvider>
          </div>
      </body>
    </html>
  );
}
