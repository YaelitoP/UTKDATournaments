'use client'
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/authContext';
import { supabase } from '@/utils/supabase/supabaseClient';
import { 
  Trophy, 
  MapPin, 
  Calendar, 
  ChevronRight, 
  LayoutDashboard,
  Search,
  Filter
} from 'lucide-react';

type Tournament = {
  id: string;
  nombre: string;
  ciudad: string | null;
  pais: string | null;
  fecha: string;
  estado: 'BORRADOR' | 'PUBLICADO' | 'FINALIZADO';
};

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;

    const fetchTournaments = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .neq('estado', 'BORRADOR')
        .order('fecha', { ascending: true });

      if (error) {
        console.error('Error fetching tournaments:', error.message);
      } else {
        setTournaments(data ?? []);
      }
      setLoading(false);
    };

    fetchTournaments();
  }, [user]);

  if (!authLoading && !user) return null;

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Torneos</h1>
            <p className="text-slate-500 font-medium">Inscribe a tus alumnos en los próximos eventos oficiales.</p>
          </div>
          <button 
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            <LayoutDashboard size={18} />
            Volver al Panel
          </button>
        </div>

        {/* Search & Filter Bar (Optional but looks good) */}
        <div className="flex flex-col md:flex-row gap-4 mb-10">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nombre de torneo..." 
              className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-600"
            />
          </div>
          <button className="flex items-center gap-2 px-6 py-4 bg-white border border-slate-200 text-slate-400 font-bold rounded-2xl hover:text-slate-600 transition-all">
            <Filter size={20} />
            Filtros
          </button>
        </div>

        {loading ? (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm animate-pulse space-y-6">
                <div className="h-8 w-3/4 bg-slate-50 rounded-xl"></div>
                <div className="space-y-3">
                  <div className="h-4 w-1/2 bg-slate-50 rounded-lg"></div>
                  <div className="h-4 w-1/3 bg-slate-50 rounded-lg"></div>
                </div>
                <div className="pt-4 flex justify-end">
                  <div className="h-10 w-32 bg-slate-50 rounded-full"></div>
                </div>
              </div>
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <div className="bg-white p-20 rounded-[3rem] shadow-sm border border-slate-100 text-center flex flex-col items-center max-w-2xl mx-auto">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 text-slate-200">
              <Trophy size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">Sin Torneos Activos</h3>
            <p className="text-slate-400 font-bold italic tracking-wide">No hay torneos publicados en este momento.</p>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((tournament) => (
              <div 
                key={tournament.id} 
                className="group relative bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-2xl hover:shadow-blue-900/5 hover:-translate-y-1 transition-all duration-500 cursor-pointer overflow-hidden"
                onClick={() => router.push(`/torneos/${tournament.id}`)}
              >
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                  <Trophy size={120} />
                </div>

                <div className="relative z-10">
                  <div className="mb-6 flex justify-between items-start">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-sm group-hover:shadow-lg group-hover:shadow-blue-200">
                      <Trophy size={24} />
                    </div>
                    <span className="text-[10px] font-black bg-slate-50 text-slate-400 px-3 py-1 rounded-full uppercase tracking-[0.2em] border border-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-100 transition-all duration-500">
                      Oficial
                    </span>
                  </div>

                  <h2 className="text-2xl font-black text-slate-900 group-hover:text-blue-600 transition-all duration-500 mb-4 leading-tight tracking-tight uppercase">
                    {tournament.nombre}
                  </h2>

                  <div className="space-y-3 mb-8">
                    <div className="flex items-center gap-3 text-slate-500 group-hover:text-slate-700 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                        <MapPin size={16} />
                      </div>
                      <span className="text-sm font-bold">{tournament.ciudad}, {tournament.pais}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-500 group-hover:text-slate-700 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                        <Calendar size={16} />
                      </div>
                      <span className="text-sm font-bold">
                        {new Date(tournament.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">Inscribir Ahora</span>
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white group-hover:translate-x-1 transition-all duration-500">
                      <ChevronRight size={20} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
