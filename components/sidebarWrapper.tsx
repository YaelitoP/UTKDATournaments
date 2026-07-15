'use client'
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/sidebar';
import { useAuth } from '@/components/authContext';

export default function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, authLoading } = useAuth();

  // No mostrar sidebar en login o si no hay usuario (a menos que estemos cargando)
  const noSidebarPaths = ['/', '/login', '/forgot-password'];
  const showSidebar = !noSidebarPaths.includes(pathname) && user && !authLoading;

  if (!showSidebar) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 h-screen overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
