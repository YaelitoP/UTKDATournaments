'use client'
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/authContext';
import { supabase } from '@/utils/supabase/supabaseClient';

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
    <div className="p-6 max-w-4xl mx-auto min-h-screen bg-gray-50">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Torneos Disponibles</h1>
        <button 
          onClick={() => router.push('/dashboard')}
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-semibold rounded-md hover:bg-gray-50 transition-colors shadow-sm"
        >
          Volver al Panel
        </button>
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white p-6 rounded-xl border animate-pulse space-y-4">
              <div className="h-6 w-3/4 bg-gray-200 rounded"></div>
              <div className="space-y-2">
                <div className="h-4 w-1/2 bg-gray-100 rounded"></div>
                <div className="h-4 w-1/3 bg-gray-100 rounded"></div>
              </div>
              <div className="flex justify-end pt-2">
                <div className="h-8 w-32 bg-gray-50 rounded-full"></div>
              </div>
            </div>
          ))}
        </div>
      ) : tournaments.length === 0 ? (
        <div className="bg-white p-12 rounded-xl shadow-sm border text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-300">
            📅
          </div>
          <p className="text-gray-500 font-medium italic">No hay torneos publicados en este momento.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {tournaments.map((tournament) => (
            <div 
              key={tournament.id} 
              className="bg-white p-6 rounded-xl shadow-sm border hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
              onClick={() => router.push(`/torneos/${tournament.id}`)}
            >
              <h2 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors mb-2">
                {tournament.nombre}
              </h2>
              <div className="space-y-1 text-sm text-gray-600">
                <p>
                  <span className="font-semibold">Ubicación:</span> {tournament.ciudad}, {tournament.pais}
                </p>
                <p>
                  <span className="font-semibold">Fecha:</span> {new Date(tournament.fecha).toLocaleDateString()}
                </p>
              </div>
              <div className="mt-6 flex justify-end">
                <span className="text-xs bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full font-bold uppercase tracking-wider border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  Inscribir competidores →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
