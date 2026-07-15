'use client'
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/authContext';
import { supabase } from '@/utils/supabase/supabaseClient';
import ModalInscripcion from '@/components/modalInscripcion';
import { 
  Users, 
  Trophy, 
  ChevronRight, 
  LayoutDashboard,
  UserPlus
} from 'lucide-react';

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

type EnrollmentDetail = {
  tournament_id: string;
  tournament_nombre: string;
  modality_label: string;
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
  
  // Enrollment states
  const [allEnrollments, setAllEnrollments] = useState<Record<string, EnrollmentDetail[]>>({});
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null);

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

        // Fetch all individual enrollments for badges
        const { data: enrollData } = await supabase
          .from('individual_entries')
          .select(`
            competitor_id,
            tournament_id,
            tournaments (nombre),
            modalities (label)
          `)
          .eq('coach_id', user.id);

        const enrollMap: Record<string, EnrollmentDetail[]> = {};
        enrollData?.forEach((e: any) => {
          if (!enrollMap[e.competitor_id]) enrollMap[e.competitor_id] = [];
          enrollMap[e.competitor_id].push({
            tournament_id: e.tournament_id,
            tournament_nombre: e.tournaments?.nombre || 'Torneo Desconocido',
            modality_label: e.modalities?.label || 'Modalidad'
          });
        });
        setAllEnrollments(enrollMap);
      } catch (error: any) {
        console.error('Dashboard: Error fetching data:', error.message);
      } finally {
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

  if (!authLoading && !user) return null;

  return (
    <div className="p-8">
      {/* Header - Con estética institucional */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Panel de Control
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Bienvenido, Sabomnim {coachProfile?.nombre}
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20 active:scale-95"
          >
            <UserPlus size={20} />
            Nuevo Competidor
          </button>
        </div>
      </div>

      {/* Resumen de Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Alumnos</p>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-black text-slate-900 leading-none">{competitors.length}</span>
            <span className="text-slate-400 text-sm font-bold pb-0.5">Competidores</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Inscripciones</p>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-black text-blue-600 leading-none">
              {Object.keys(allEnrollments).length}
            </span>
            <span className="text-slate-400 text-sm font-bold pb-0.5">Activas</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Equipos</p>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-black text-indigo-600 leading-none">{teams.length}</span>
            <span className="text-slate-400 text-sm font-bold pb-0.5">Registrados</span>
          </div>
        </div>
      </div>

      {/* Tabs Estilizados */}
      <div className="flex gap-2 p-1.5 bg-slate-200/50 rounded-2xl w-fit mb-8 border border-slate-200">
        <button
          className={`px-8 py-2.5 font-bold text-sm transition-all rounded-xl ${
            activeTab === 'competidores' 
              ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('competidores')}
        >
          Mis Competidores
        </button>
        <button
          className={`px-8 py-2.5 font-bold text-sm transition-all rounded-xl ${
            activeTab === 'equipos' 
              ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('equipos')}
        >
          Mis Equipos
        </button>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Cargando Datos...</p>
          </div>
        ) : activeTab === 'competidores' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Nombre y Apellido</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Graduación</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Inscripciones</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {competitors.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Users size={48} className="text-slate-200" />
                        <p className="text-slate-400 font-medium">Aún no tienes alumnos registrados.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  competitors.map(c => {
                    const enrollments = allEnrollments[c.id] || [];
                    const uniqueTournamentCount = new Set(enrollments.map(e => e.tournament_id)).size;
                    
                    return (
                      <tr 
                        key={c.id} 
                        className="hover:bg-blue-50/30 transition-all cursor-pointer group"
                        onClick={() => {
                          if (uniqueTournamentCount > 0) {
                            setSelectedCompetitor(c);
                            setShowEnrollmentModal(true);
                          }
                        }}
                      >
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                              {c.nombre[0]}{c.apellido[0]}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{c.apellido}, {c.nombre}</div>
                              <div className="text-xs text-slate-400 font-medium">{c.documento} • {c.sexo}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <span className={`px-3 py-1 text-[10px] font-black rounded-lg border uppercase tracking-wider ${
                            c.cinturón_tipo === 'DAN' 
                              ? 'bg-slate-900 text-white border-slate-900' 
                              : 'bg-white text-blue-600 border-blue-200'
                          }`}>
                            {c.cinturón_grado} {c.cinturón_tipo}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex justify-center">
                            {uniqueTournamentCount > 0 ? (
                              <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-[10px] font-black rounded-full border border-green-100 uppercase tracking-tight">
                                <Trophy size={10} />
                                {uniqueTournamentCount} Torneo{uniqueTournamentCount > 1 ? 's' : ''}
                              </div>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">Sin Actividad</span>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <button className="text-slate-300 group-hover:text-blue-600 transition-colors p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-100 shadow-sm">
                            <ChevronRight size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Nombre del Equipo</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">División</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Modalidad</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {teams.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center text-slate-400">
                      No has creado equipos todavía.
                    </td>
                  </tr>
                ) : (
                  teams.map(t => (
                    <tr key={t.id} className="hover:bg-blue-50/30 transition-all">
                      <td className="px-8 py-5">
                        <div className="font-bold text-slate-900">{t.nombre_equipo}</div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex gap-2">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded uppercase tracking-wider">{t.division_edad}</span>
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded uppercase border border-blue-100 tracking-wider">{t.genero}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded-lg border border-indigo-100 uppercase tracking-wider">
                          {t.modality_label}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button className="text-slate-300 hover:text-blue-600 transition-colors">
                          <ChevronRight size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <ModalInscripcion 
          closeModal={() => setShowModal(false)} 
          onCompetitorAdded={handleCompetitorAdded} 
        />
      )}

      {showEnrollmentModal && selectedCompetitor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Inscripciones Activas</h3>
                <p className="text-sm text-gray-500">{selectedCompetitor.apellido}, {selectedCompetitor.nombre}</p>
              </div>
              <button onClick={() => setShowEnrollmentModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="space-y-4">
                {/* Agrupar por torneo */}
                {Object.entries(
                  (allEnrollments[selectedCompetitor.id] || []).reduce((acc, curr) => {
                    if (!acc[curr.tournament_id]) acc[curr.tournament_id] = { name: curr.tournament_nombre, mods: [] };
                    acc[curr.tournament_id].mods.push(curr.modality_label);
                    return acc;
                  }, {} as Record<string, { name: string, mods: string[] }>)
                ).map(([tId, info]) => (
                  <div key={tId} className="p-4 rounded-xl border border-blue-100 bg-blue-50/30 group hover:border-blue-300 transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-bold text-blue-900">{info.name}</h4>
                      <button 
                        onClick={() => router.push(`/torneos/${tId}`)}
                        className="text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:underline"
                      >
                        Ver Torneo →
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {info.mods.map((m, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-white border border-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 bg-gray-50 border-t flex justify-end">
              <button 
                onClick={() => setShowEnrollmentModal(false)}
                className="px-6 py-2 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-100 transition-colors shadow-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
