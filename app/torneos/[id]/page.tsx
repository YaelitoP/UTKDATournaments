'use client'
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/components/authContext';
import { supabase } from '@/utils/supabase/supabaseClient';

type Modality = {
  id: string;
  code: string;
  label: string;
  scope: 'INDIVIDUAL' | 'TEAM';
};

type Tournament = {
  id: string;
  nombre: string;
  fecha: string;
};

export default function TournamentDetailPage() {
  const { id } = useParams();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [modalities, setModalities] = useState<Modality[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user || !id) return;

    const fetchData = async () => {
      setLoading(true);
      
      // Fetch tournament details
      const { data: tData, error: tError } = await supabase
        .from('tournaments')
        .select('id, nombre, fecha')
        .eq('id', id)
        .single();

      if (tError) {
        console.error('Error fetching tournament:', tError.message);
        router.push('/torneos');
        return;
      }
      setTournament(tData);

      // Fetch modalities for this tournament
      const { data: mData, error: mError } = await supabase
        .from('tournament_modalities')
        .select(`
          modality_id,
          modalities (id, code, label, scope)
        `)
        .eq('tournament_id', id)
        .eq('enabled', true);

      if (mError) {
        console.error('Error fetching modalities:', mError.message);
      } else {
        const mods = mData?.map((item: any) => item.modalities) || [];
        setModalities(mods);
      }
      setLoading(false);
    };

    fetchData();
  }, [user, id]);

  if (!authLoading && !user) return null;

  const individualMods = modalities.filter(m => m.scope === 'INDIVIDUAL');
  const teamMods = modalities.filter(m => m.scope === 'TEAM');

  return (
    <div className="p-6 max-w-4xl mx-auto min-h-screen bg-gray-50">
      {loading ? (
        <div className="animate-pulse space-y-8">
          <div className="h-6 w-32 bg-gray-200 rounded mb-8"></div>
          <div className="h-10 w-64 bg-gray-300 rounded"></div>
          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-4">
              <div className="h-8 w-32 bg-gray-200 rounded mb-4"></div>
              {[1, 2, 3].map(i => <div key={i} className="h-16 w-full bg-white border rounded-lg"></div>)}
            </div>
            <div className="space-y-4">
              <div className="h-8 w-32 bg-gray-200 rounded mb-4"></div>
              {[1, 2].map(i => <div key={i} className="h-16 w-full bg-white border rounded-lg"></div>)}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <button 
              onClick={() => router.push('/torneos')}
              className="mb-4 text-blue-600 hover:underline flex items-center gap-2 font-medium"
            >
              ← Volver a torneos
            </button>
            <h1 className="text-3xl font-bold text-gray-900">{tournament?.nombre}</h1>
            <p className="text-gray-600">Fecha: {tournament ? new Date(tournament.fecha).toLocaleDateString() : ''}</p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {/* Individual Modalites */}
            <div>
              <h2 className="text-2xl font-bold mb-4 text-gray-800 border-b pb-2">Individual</h2>
              <div className="space-y-3">
                {individualMods.length === 0 ? (
                  <p className="text-gray-500 italic">No hay modalidades individuales habilitadas.</p>
                ) : (
                  individualMods.map(mod => (
                    <button
                      key={mod.id}
                      onClick={() => router.push(`/torneos/${id}/individual/${mod.id}`)}
                      className="w-full text-left p-4 bg-white border rounded-lg shadow-sm hover:border-blue-500 hover:bg-blue-50 transition-all flex justify-between items-center group"
                    >
                      <span className="font-medium text-gray-700">{mod.label}</span>
                      <span className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Team Modalities */}
            <div>
              <h2 className="text-2xl font-bold mb-4 text-gray-800 border-b pb-2">Equipos</h2>
              <div className="space-y-3">
                {teamMods.length === 0 ? (
                  <p className="text-gray-500 italic">No hay modalidades por equipo habilitadas.</p>
                ) : (
                  teamMods.map(mod => (
                    <button
                      key={mod.id}
                      onClick={() => router.push(`/torneos/${id}/equipo/${mod.id}`)}
                      className="w-full text-left p-4 bg-white border rounded-lg shadow-sm hover:border-blue-500 hover:bg-blue-50 transition-all flex justify-between items-center group"
                    >
                      <span className="font-medium text-gray-700">{mod.label}</span>
                      <span className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
