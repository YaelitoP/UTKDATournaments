'use client'
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/authContext';
import { 
  LayoutDashboard, 
  Users, 
  Trophy, 
  UserCircle, 
  LogOut,
  ChevronRight
} from 'lucide-react';

export default function Sidebar() {
  const { coachProfile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Mis Alumnos', icon: Users, path: '/dashboard' }, // Por ahora mismo dashboard, se puede filtrar
    { name: 'Torneos', icon: Trophy, path: '/torneos' },
    { name: 'Mi Perfil', icon: UserCircle, path: '/coach/registro?mode=edit' },
  ];

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen sticky top-0 border-r border-slate-800 shadow-xl z-20">
      {/* Hierarchy of Logos */}
      <div className="p-6 space-y-8">
        {/* ITF - Parent Organization (Top Importance) */}
        <div className="flex flex-col items-center gap-4 border-b border-slate-800 pb-8">
          <div className="flex items-center justify-center gap-4">
            <Image 
              src="/itf-logo.png" 
              alt="ITF Logo" 
              width={50} 
              height={50} 
              className="object-contain brightness-110"
            />
            <div className="w-px h-8 bg-slate-800" />
            <Image 
              src="/itf-full-logo.png" 
              alt="ITF Full Logo" 
              width={120} 
              height={40} 
              className="object-contain brightness-110"
            />
          </div>
          <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] text-center leading-none">
            International Taekwon-Do Federation
          </span>
        </div>

        {/* UTKDA & Genesis - Middle/Local hierarchy */}
        <div className="flex flex-col items-center gap-8">
          {/* UTKDA - Leader of Genesis (Middle Importance) */}
          <div className="flex flex-col items-center gap-3 group">
            <div className="relative">
              <div className="absolute -inset-1 bg-blue-500/20 rounded-full blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
              <Image 
                src="/utkda-logo.png" 
                alt="UTKDA Logo" 
                width={80} 
                height={80} 
                className="relative object-contain"
              />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center leading-none">
              Organización Líder
            </span>
          </div>

          {/* Genesis - Local Organization (Third Importance) */}
          <div className="flex flex-col items-center gap-3 opacity-60 hover:opacity-100 transition-opacity duration-300">
            <Image 
              src="/Genesis-logo.png" 
              alt="Genesis Logo" 
              width={60} 
              height={60} 
              className="object-contain grayscale hover:grayscale-0 transition-all duration-300"
            />
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center leading-none">
              Genesis
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <button
              key={item.name}
              onClick={() => router.push(item.path)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon size={20} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-blue-400 transition-colors'} />
                <span className="font-semibold text-sm">{item.name}</span>
              </div>
              {isActive && <ChevronRight size={14} className="text-blue-200" />}
            </button>
          );
        })}
      </nav>

      {/* User & Logout */}
      <div className="p-4 bg-slate-950/50 border-t border-slate-800">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-inner border border-blue-400/20">
            {coachProfile?.nombre?.charAt(0)}{coachProfile?.apellido?.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">
              {coachProfile?.nombre} {coachProfile?.apellido}
            </p>
            <p className="text-[10px] font-bold text-slate-500 uppercase truncate tracking-wider">
              {coachProfile?.escuela || 'Sabomnim'}
            </p>
          </div>
        </div>
        <button 
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-200 font-bold text-xs uppercase tracking-widest"
        >
          <LogOut size={18} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
