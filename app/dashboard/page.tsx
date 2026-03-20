'use client'
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/authContext';
import { supabase } from '@/utils/supabase/supabaseClient';
import Modal from '@/components/modalInscripcion';

type Competitor = {
  id: string;
  nombre: string;
  apellido: string;
  sexo: string;
  fecha_nacimiento: string;
  cinturón_tipo: string;
  cinturón_grado: number;
  documento: string;
};

type Team = {
  id: string;
  nombre_equipo: string;
  division_edad: string;
  cinturón_tipo: string;
  cinturón_grado: number;
  genero: string;
  modality_label?: string;
};

export default function DashboardPage() {
  const { user, loading: authLoading, coachProfile, signOut } = useAuth();
  const router = useRouter();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'competidores' | 'equipos'>('competidores');
  const [showModal, setShowModal] = useState(false);
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) setShowRetry(true);
    }, 6000); // 6 segundos de gracia para mostrar el botón de reintento
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    // Escalera de dependencias: No disparamos consultas si no tenemos perfil validado
    if (authLoading || !user) return;

    // Si la carga de auth terminó pero no hay perfil, el coach debe registrarse.
    // PostLogin ya debería haberlo atrapado, pero esto es una red de seguridad.
    if (!coachProfile) {
      console.warn("Dashboard: No coachProfile found, waiting or redirecting...");
      // Si el AuthProvider ya terminó (authLoading=false) y seguimos sin perfil tras el timeout,
      // algo falló en la obtención del perfil.
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      console.log("Dashboard: Fetching data for coach:", user.id);
      
      try {
        // Fetch competitors
        const { data: compData, error: compError } = await supabase
          .from('competitors')
          .select('*')
          .eq('coach_id', user.id)
          .order('apellido', { ascending: true });

        if (compError) throw compError;
        setCompetitors(compData ?? []);

        // Fetch teams with modality label
        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select(`
            *,
            modalities (label)
          `)
          .eq('coach_id', user.id);

        if (teamsError) throw teamsError;

        const formattedTeams = teamsData?.map((t: any) => ({
          ...t,
          modality_label: t.modalities?.label
        })) || [];

        setTeams(formattedTeams);
      } catch (error: any) {
        console.error('Dashboard: Error fetching data:', error.message);
      } finally {
        // ASEGURAMOS que el loading se libere siempre, incluso con error 400
        setLoading(false);
      }
    };

    fetchData();
  }, [user, authLoading, coachProfile]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  const handleCompetitorAdded = (newComp: Competitor) => {
    setCompetitors(prev => [...prev, newComp].sort((a, b) => a.apellido.localeCompare(b.apellido)));
  };

  // YA NO bloqueamos todo el Dashboard con authLoading.
  // Solo redirigimos si NO hay usuario tras terminar la carga.
  if (!authLoading && !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Siempre visible tras Auth inicial */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            {coachProfile ? (
              <>
                <h1 className="text-xl font-bold text-gray-900">
                  {coachProfile.nombre} {coachProfile.apellido}
                </h1>
                <p className="text-sm text-gray-500 font-medium">{coachProfile.escuela || 'Dojang'}</p>
              </>
            ) : (
              <div className="animate-pulse space-y-2">
                <div className="h-6 w-32 bg-gray-200 rounded"></div>
                <div className="h-4 w-24 bg-gray-100 rounded"></div>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => router.push('/coach/registro?mode=edit')}
              className="px-4 py-2 text-sm font-semibold text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 transition-colors"
            >
              Editar Perfil
            </button>
            <button 
              onClick={handleSignOut}
              className="px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Quick Access to Tournaments */}
        <div className="mb-8 bg-blue-600 rounded-xl p-6 text-white shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold">Torneos Abiertos</h2>
            <p className="opacity-90">Inscribe a tus competidores y equipos en los próximos eventos.</p>
          </div>
          <button 
            onClick={() => router.push('/torneos')}
            className="px-8 py-3 bg-white text-blue-600 font-bold rounded-lg hover:bg-gray-100 transition-colors shadow-md"
          >
            Ver Torneos →
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            className={`px-6 py-3 font-bold text-sm transition-colors border-b-2 ${
              activeTab === 'competidores' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('competidores')}
          >
            Mis Competidores ({loading ? '...' : competitors.length})
          </button>
          <button
            className={`px-6 py-3 font-bold text-sm transition-colors border-b-2 ${
              activeTab === 'equipos' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('equipos')}
          >
            Ver Equipos ({loading ? '...' : teams.length})
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="h-7 w-48 bg-gray-200 animate-pulse rounded"></div>
              <div className="h-10 w-40 bg-gray-100 animate-pulse rounded"></div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-8 flex flex-col items-center justify-center min-h-[300px]">
              <div className="w-full space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-4 items-center">
                    <div className="h-4 flex-1 bg-gray-100 animate-pulse rounded"></div>
                    <div className="h-4 w-24 bg-gray-50 animate-pulse rounded"></div>
                    <div className="h-4 w-32 bg-gray-50 animate-pulse rounded"></div>
                  </div>
                ))}
              </div>
              {showRetry && (
                <div className="mt-12 p-6 bg-blue-50 border border-blue-100 rounded-xl text-center max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <p className="text-blue-800 font-bold mb-2 text-sm">¿La carga se demora más de lo normal?</p>
                  <p className="text-blue-600 text-xs mb-4">A veces el navegador bloquea la sincronización. Intenta recargar el panel manualmente.</p>
                  <button 
                    onClick={() => window.location.reload()}
                    className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md shadow-blue-200 transition-all active:scale-95 text-xs"
                  >
                    Recargar Panel Ahora
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'competidores' ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800">Listado de Alumnos</h3>
              <button 
                onClick={() => setShowModal(true)}
                className="px-4 py-2 bg-green-600 text-white font-bold rounded-md hover:bg-green-700 transition-colors shadow-sm text-sm"
              >
                + Nuevo Competidor
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Nombre</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Cinturón</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Documento</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Sexo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {competitors.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">
                        No has registrado competidores aún.
                      </td>
                    </tr>
                  ) : (
                    competitors.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900">{c.apellido}, {c.nombre}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded uppercase border border-blue-100">
                            {c.cinturón_grado} {c.cinturón_tipo}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{c.documento}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{c.sexo}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800">Equipos Armados</h3>
              <p className="text-sm text-gray-500">Para crear un equipo, ve a la sección de Torneos.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.length === 0 ? (
                <div className="col-span-full bg-white rounded-lg border border-dashed border-gray-300 py-12 flex flex-col items-center justify-center text-gray-400">
                  <p className="italic">No has creado equipos todavía.</p>
                  <button 
                    onClick={() => router.push('/torneos')}
                    className="mt-4 text-blue-600 font-bold hover:underline"
                  >
                    Ir a Torneos para crear uno
                  </button>
                </div>
              ) : (
                teams.map(t => (
                  <div key={t.id} className="bg-white p-5 rounded-xl shadow-sm border hover:border-blue-300 transition-all group">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{t.nombre_equipo}</h4>
                      <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full uppercase">
                        {t.modality_label || 'Equipo'}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs text-gray-500 font-medium">
                      <p>División: {t.division_edad}</p>
                      <p>Cinturón: {t.cinturón_grado} {t.cinturón_tipo}</p>
                      <p>Género: {t.genero}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {showModal && (
        <Modal 
          closeModal={() => setShowModal(false)} 
          onCompetitorAdded={handleCompetitorAdded} 
        />
      )}
    </div>
  );
}
