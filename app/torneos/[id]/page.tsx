'use client'
import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/components/authContext';
import { supabase } from '@/utils/supabase/supabaseClient';
import ModalInscripcion from '@/components/modalInscripcion';
import { 
  ChevronLeft, 
  Users, 
  Trophy, 
  Plus, 
  Save, 
  X, 
  Trash2, 
  UserPlus,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

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

type Competitor = {
  id: string;
  nombre: string;
  apellido: string;
  cinturón_tipo: string;
  cinturón_grado: number;
  sexo: string;
  fecha_nacimiento: string;
};

type Team = {
  id: string;
  nombre_equipo: string;
  division_edad: string;
  cinturón_tipo: string;
  cinturón_grado: number;
  genero: string;
  modality_id: string;
};

type TeamMember = {
  team_id: string;
  competitor_id: string;
  competitors: {
    nombre: string;
    apellido: string;
  };
};

type EnrollmentMap = Record<string, Set<string>>; // competitorId -> Set of modalityIds
type TeamEnrollmentMap = Record<string, Set<string>>; // teamName -> Set of modalityIds (grouped by name for UI)

export default function TournamentDetailPage() {
  const { id } = useParams();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [modalities, setModalities] = useState<Modality[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentMap>({});
  
  // Team states
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamEnrollments, setTeamEnrollments] = useState<TeamEnrollmentMap>({});
  const [teamMembers, setTeamMembers] = useState<Record<string, any[]>>({}); // teamName -> list of members
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  
  // Form states para nuevo equipo
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamAge, setNewTeamAge] = useState('ADULTO');
  const [newTeamBelt, setNewTeamBelt] = useState('DAN');
  const [newTeamGrade, setNewTeamGrade] = useState(1);
  const [newTeamGender, setNewTeamGender] = useState('MIXTO');

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'individual' | 'teams'>('individual');
  const [showAddCompetitorModal, setShowAddCompetitorModal] = useState(false);
  
  // UI States para edición
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempEnrollments, setTempEnrollments] = useState<Set<string>>(new Set());
  const [editingTeamName, setEditingTeamName] = useState<string | null>(null);
  const [tempTeamEnrollments, setTempTeamEnrollments] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const { user, loading: authLoading, coachProfile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user || !id || !coachProfile) return;

    const fetchData = async () => {
      setLoading(true);
      
      try {
        // 1. Fetch tournament details
        const { data: tData, error: tError } = await supabase
          .from('tournaments')
          .select('id, nombre, fecha')
          .eq('id', id)
          .single();

        if (tError) throw tError;
        setTournament(tData);

        // 2. Fetch modalities, competitors and current enrollments in parallel
        const [mRes, cRes, eRes, tRes] = await Promise.all([
          supabase.from('tournament_modalities').select('modalities(id, code, label, scope)').eq('tournament_id', id).eq('enabled', true),
          supabase.from('competitors').select('*').eq('coach_id', user.id).order('apellido'),
          supabase.from('individual_entries').select('competitor_id, modality_id').eq('tournament_id', id).eq('coach_id', user.id),
          supabase.from('teams').select('*').eq('tournament_id', id).eq('coach_id', user.id)
        ]);

        const mods = mRes.data?.map((item: any) => item.modalities) || [];
        setModalities(mods);
        setCompetitors(cRes.data || []);
        setTeams(tRes.data || []);

        // Fetch team members for all these teams
        const teamIds = tRes.data?.map(t => t.id) || [];
        if (teamIds.length > 0) {
          const { data: tmData } = await supabase
            .from('team_members')
            .select('team_id, competitor_id, competitors(nombre, apellido)')
            .in('team_id', teamIds);
            
          // Agrupar miembros por nombre de equipo (ya que los equipos con el mismo nombre deben tener los mismos miembros)
          const tmMap: Record<string, any[]> = {};
          tmData?.forEach(tm => {
            const team = tRes.data?.find(t => t.id === tm.team_id);
            if (team) {
              if (!tmMap[team.nombre_equipo]) tmMap[team.nombre_equipo] = [];
              // Evitar duplicados si el mismo competidor está en varias filas de la misma "agrupación de equipo"
              if (!tmMap[team.nombre_equipo].some(m => m.competitor_id === tm.competitor_id)) {
                tmMap[team.nombre_equipo].push(tm);
              }
            }
          });
          setTeamMembers(tmMap);
        }

        // Transformar individual enrollments
        const eMap: EnrollmentMap = {};
        eRes.data?.forEach(e => {
          if (!eMap[e.competitor_id]) eMap[e.competitor_id] = new Set();
          eMap[e.competitor_id].add(e.modality_id);
        });
        setEnrollments(eMap);

        // Transformar team enrollments (agrupados por nombre_equipo para la UI de checkboxes)
        const teMap: TeamEnrollmentMap = {};
        tRes.data?.forEach((t: Team) => {
          if (!teMap[t.nombre_equipo]) teMap[t.nombre_equipo] = new Set();
          teMap[t.nombre_equipo].add(t.modality_id);
        });
        setTeamEnrollments(teMap);

      } catch (err: any) {
        console.error('Error fetching tournament data:', err.message);
        router.push('/torneos');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, id, coachProfile, router]);

  const individualMods = useMemo(() => modalities.filter(m => m.scope === 'INDIVIDUAL'), [modalities]);
  const teamMods = useMemo(() => modalities.filter(m => m.scope === 'TEAM'), [modalities]);

  // Agrupar equipos por nombre para la UI unificada
  const uniqueTeams = useMemo(() => {
    const map: Record<string, Team> = {};
    teams.forEach(t => {
      if (!map[t.nombre_equipo]) map[t.nombre_equipo] = t;
    });
    return Object.values(map);
  }, [teams]);

  const handleEdit = (competitor: Competitor) => {
    setEditingId(competitor.id);
    setTempEnrollments(new Set(enrollments[competitor.id] || []));
  };

  const toggleTempModality = (modalityId: string) => {
    setTempEnrollments(prev => {
      const next = new Set(prev);
      if (next.has(modalityId)) next.delete(modalityId);
      else next.add(modalityId);
      return next;
    });
  };

  const handleSave = async (competitor: Competitor) => {
    if (!user || !id) return;
    setIsSaving(true);

    try {
      const current = enrollments[competitor.id] || new Set();
      const toAdd = Array.from(tempEnrollments).filter(mId => !current.has(mId));
      const toRemove = Array.from(current).filter(mId => !tempEnrollments.has(mId));

      // 1. Eliminar desmarcados
      if (toRemove.length > 0) {
        await supabase
          .from('individual_entries')
          .delete()
          .eq('tournament_id', id)
          .eq('competitor_id', competitor.id)
          .in('modality_id', toRemove);
      }

      // 2. Insertar nuevos
      if (toAdd.length > 0) {
        const newEntries = toAdd.map(mId => ({
          tournament_id: id,
          coach_id: user.id,
          competitor_id: competitor.id,
          modality_id: mId,
          status: 'ACTIVA',
          snap_nombre: competitor.nombre,
          snap_apellido: competitor.apellido,
          snap_sexo: competitor.sexo,
          snap_fecha_nacimiento: competitor.fecha_nacimiento,
          snap_cinturón_tipo: competitor.cinturón_tipo,
          snap_cinturón_grado: competitor.cinturón_grado
        }));
        await supabase.from('individual_entries').insert(newEntries);
      }

      // Actualizar estado local
      setEnrollments(prev => ({
        ...prev,
        [competitor.id]: new Set(tempEnrollments)
      }));
      setEditingId(null);
    } catch (err: any) {
      alert('Error al guardar inscripciones: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditTeam = (team: Team) => {
    setEditingTeamName(team.nombre_equipo);
    setTempTeamEnrollments(new Set(teamEnrollments[team.nombre_equipo] || []));
  };

  const toggleTempTeamModality = (modalityId: string) => {
    setTempTeamEnrollments(prev => {
      const next = new Set(prev);
      if (next.has(modalityId)) next.delete(modalityId);
      else next.add(modalityId);
      return next;
    });
  };

  const handleSaveTeam = async (teamName: string) => {
    if (!user || !id) return;
    setIsSaving(true);

    try {
      const current = teamEnrollments[teamName] || new Set();
      const toAdd = Array.from(tempTeamEnrollments).filter(mId => !current.has(mId));
      const toRemove = Array.from(current).filter(mId => !tempTeamEnrollments.has(mId));

      // Obtenemos los datos base de este equipo de la lista actual de teams
      const baseTeam = teams.find(t => t.nombre_equipo === teamName);
      if (!baseTeam) return;

      // 1. Eliminar desmarcados
      if (toRemove.length > 0) {
        await supabase
          .from('teams')
          .delete()
          .eq('tournament_id', id)
          .eq('coach_id', user.id)
          .eq('nombre_equipo', teamName)
          .in('modality_id', toRemove);
      }

      // 2. Insertar nuevos
      if (toAdd.length > 0) {
        const newEntries = toAdd.map(mId => ({
          tournament_id: id,
          coach_id: user.id,
          modality_id: mId,
          nombre_equipo: baseTeam.nombre_equipo,
          division_edad: baseTeam.division_edad,
          cinturón_tipo: baseTeam.cinturón_tipo,
          cinturón_grado: baseTeam.cinturón_grado,
          genero: baseTeam.genero,
          status: 'ACTIVA'
        }));
        
        const { data: insertedTeams } = await supabase.from('teams').insert(newEntries).select();
        
        // Copiar integrantes a las nuevas modalidades
        if (insertedTeams && insertedTeams.length > 0) {
          const members = teamMembers[teamName] || [];
          if (members.length > 0) {
            const newMemberships = insertedTeams.flatMap(t => 
              members.map(m => ({ team_id: t.id, competitor_id: m.competitor_id }))
            );
            await supabase.from('team_members').insert(newMemberships);
          }
        }
      }

      // Actualizar estado local
      setTeamEnrollments(prev => ({
        ...prev,
        [teamName]: new Set(tempTeamEnrollments)
      }));
      
      // Refetch teams to get the new IDs
      const { data } = await supabase.from('teams').select('*').eq('tournament_id', id).eq('coach_id', user.id);
      setTeams(data || []);
      
      setEditingTeamName(null);
    } catch (err: any) {
      alert('Error al guardar inscripciones del equipo: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMemberToTeam = async (teamName: string, competitorId: string) => {
    const teamIds = teams.filter(t => t.nombre_equipo === teamName).map(t => t.id);
    if (teamIds.length === 0) return;

    try {
      const newMemberships = teamIds.map(tid => ({ team_id: tid, competitor_id: competitorId }));
      await supabase.from('team_members').insert(newMemberships);

      // Actualizar estado local
      const competitor = competitors.find(c => c.id === competitorId);
      if (competitor) {
        setTeamMembers(prev => ({
          ...prev,
          [teamName]: [...(prev[teamName] || []), {
            competitor_id: competitorId,
            competitors: { nombre: competitor.nombre, apellido: competitor.apellido }
          }]
        }));
      }
    } catch (err: any) {
      alert('Error al agregar integrante: ' + err.message);
    }
  };

  const handleRemoveMemberFromTeam = async (teamName: string, competitorId: string) => {
    const teamIds = teams.filter(t => t.nombre_equipo === teamName).map(t => t.id);
    if (teamIds.length === 0) return;

    try {
      await supabase
        .from('team_members')
        .delete()
        .in('team_id', teamIds)
        .eq('competitor_id', competitorId);

      // Actualizar estado local
      setTeamMembers(prev => ({
        ...prev,
        [teamName]: (prev[teamName] || []).filter(m => m.competitor_id !== competitorId)
      }));
    } catch (err: any) {
      alert('Error al quitar integrante: ' + err.message);
    }
  };

  const handleDeleteTeam = async (teamName: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el equipo "${teamName}" y todas sus inscripciones?`)) return;
    setIsSaving(true);

    try {
      const teamIds = teams.filter(t => t.nombre_equipo === teamName).map(t => t.id);
      
      // La eliminación en cascada en la DB debería encargarse de team_members
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('nombre_equipo', teamName)
        .eq('tournament_id', id)
        .eq('coach_id', user.id);

      if (error) throw error;

      // Actualizar estados locales
      setTeams(prev => prev.filter(t => t.nombre_equipo !== teamName));
      setTeamEnrollments(prev => {
        const next = { ...prev };
        delete next[teamName];
        return next;
      });
      setTeamMembers(prev => {
        const next = { ...prev };
        delete next[teamName];
        return next;
      });

    } catch (err: any) {
      alert('Error al eliminar equipo: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;
    setIsSaving(true);

    try {
      // Por defecto creamos el equipo sin modalidades (o con una si el esquema lo obliga)
      // Pero como el esquema obliga a modality_id, pedimos al menos una al crear?
      // O usamos una modalidad "dummy" temporal?
      // No, mejor obligar a seleccionar al menos una modalidad al crear el equipo.
      if (tempTeamEnrollments.size === 0) {
        alert('Debes seleccionar al menos una modalidad para el equipo.');
        return;
      }

      const newEntries = Array.from(tempTeamEnrollments).map(mId => ({
        tournament_id: id,
        coach_id: user.id,
        modality_id: mId,
        nombre_equipo: newTeamName,
        division_edad: newTeamAge,
        cinturón_tipo: newTeamBelt,
        cinturón_grado: newTeamGrade,
        genero: newTeamGender,
        status: 'ACTIVA'
      }));

      const { data, error } = await supabase.from('teams').insert(newEntries).select();
      if (error) throw error;

      // Actualizar estados
      setTeams(prev => [...prev, ...(data || [])]);
      setTeamEnrollments(prev => ({
        ...prev,
        [newTeamName]: new Set(tempTeamEnrollments)
      }));
      
      setIsAddingTeam(false);
      setNewTeamName('');
      setTempTeamEnrollments(new Set());
    } catch (err: any) {
      alert('Error al crear equipo: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!authLoading && !user) return null;

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-10">
        <button 
          onClick={() => router.push('/torneos')}
          className="group mb-6 flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors font-bold text-sm uppercase tracking-widest"
        >
          <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          Volver a torneos
        </button>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg shadow-blue-200">
                <Trophy size={28} className="text-white" />
              </div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">{tournament?.nombre}</h1>
            </div>
            <p className="text-slate-500 font-medium flex items-center gap-2 pl-14">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Fecha del evento: {tournament ? new Date(tournament.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
            </p>
          </div>
          
          <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200">
            <button 
              onClick={() => setActiveTab('individual')}
              className={`flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-black transition-all duration-300 ${
                activeTab === 'individual' 
                ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' 
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Users size={18} />
              INDIVIDUAL
            </button>
            <button 
              onClick={() => setActiveTab('teams')}
              className={`flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-black transition-all duration-300 ${
                activeTab === 'teams' 
                ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' 
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Trophy size={18} />
              EQUIPOS
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 shadow-sm animate-pulse space-y-8">
            <div className="h-10 w-64 bg-slate-100 rounded-xl"></div>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-16 w-full bg-slate-50 rounded-xl border border-slate-100"></div>)}
            </div>
          </div>
        ) : activeTab === 'individual' ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Table Card */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] sticky left-0 bg-white z-10 border-r border-slate-50 w-64">Competidor</th>
                      {individualMods.map(mod => (
                        <th key={mod.id} className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] text-center min-w-[140px]">
                          {mod.label}
                        </th>
                      ))}
                      <th className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] text-right sticky right-0 bg-white z-10 border-l border-slate-50">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {competitors.length === 0 ? (
                      <tr>
                        <td colSpan={individualMods.length + 2} className="p-20 text-center">
                          <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                              <Users size={32} />
                            </div>
                            <p className="text-slate-400 font-bold italic tracking-wide">No tienes competidores registrados para inscribir.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      competitors.map(comp => {
                        const isEditing = editingId === comp.id;
                        const hasEnrollments = (enrollments[comp.id]?.size || 0) > 0;
                        
                        return (
                          <tr key={comp.id} className={`group transition-all duration-300 ${isEditing ? 'bg-blue-50/30' : 'hover:bg-slate-50/50'}`}>
                            <td className="p-6 sticky left-0 bg-inherit z-10 border-r border-slate-50">
                              <div className="font-black text-slate-900 text-lg leading-tight mb-1">{comp.apellido}, {comp.nombre}</div>
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-md border border-blue-100">
                                  {comp.cinturón_grado} {comp.cinturón_tipo}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">{comp.sexo === 'M' ? 'Masculino' : 'Femenino'}</span>
                              </div>
                            </td>
                            
                            {individualMods.map(mod => {
                              const isEnrolled = isEditing 
                                ? tempEnrollments.has(mod.id)
                                : enrollments[comp.id]?.has(mod.id);
                              
                              return (
                                <td key={mod.id} className="p-6 text-center">
                                  <div className="flex justify-center">
                                    <label className={`relative flex items-center justify-center w-8 h-8 rounded-xl border-2 transition-all duration-300 ${
                                      isEnrolled 
                                      ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200 scale-110' 
                                      : isEditing 
                                        ? 'border-slate-200 hover:border-blue-400 cursor-pointer bg-white' 
                                        : 'border-slate-100 bg-slate-50/50'
                                    }`}>
                                      <input 
                                        type="checkbox"
                                        checked={!!isEnrolled}
                                        disabled={!isEditing}
                                        onChange={() => toggleTempModality(mod.id)}
                                        className="hidden"
                                      />
                                      {isEnrolled && <CheckCircle2 size={18} strokeWidth={3} />}
                                    </label>
                                  </div>
                                </td>
                              );
                            })}

                            <td className="p-6 text-right sticky right-0 bg-inherit z-10 border-l border-slate-50">
                              {isEditing ? (
                                <div className="flex gap-3 justify-end">
                                  <button 
                                    onClick={() => setEditingId(null)}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                                    disabled={isSaving}
                                  >
                                    <X size={20} />
                                  </button>
                                  <button 
                                    onClick={() => handleSave(comp)}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 active:scale-95 transition-all"
                                    disabled={isSaving}
                                  >
                                    {isSaving ? (
                                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                      <>
                                        <Save size={16} />
                                        {tempEnrollments.size === 0 ? 'ELIMINAR' : 'GUARDAR'}
                                      </>
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => handleEdit(comp)}
                                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                                    hasEnrollments 
                                    ? 'text-blue-600 border-2 border-blue-600 hover:bg-blue-50' 
                                    : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-200'
                                  }`}
                                >
                                  {hasEnrollments ? 'EDITAR' : 'INSCRIBIR'}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Floating Action / Button Section */}
            <div className="flex justify-center pt-4">
              <button 
                onClick={() => setShowAddCompetitorModal(true)}
                className="group flex flex-col items-center gap-4 px-12 py-10 border-2 border-dashed border-slate-200 rounded-[2.5rem] text-slate-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/30 transition-all duration-500 bg-white/50"
              >
                <div className="w-14 h-14 rounded-2xl bg-slate-50 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center transition-all duration-500 shadow-sm group-hover:shadow-xl group-hover:shadow-blue-200 group-hover:-translate-y-1">
                  <UserPlus size={28} />
                </div>
                <span className="text-sm font-black uppercase tracking-[0.2em]">Agregar un nuevo competidor</span>
              </button>
            </div>

            {showAddCompetitorModal && (
              <ModalInscripcion 
                closeModal={() => setShowAddCompetitorModal(false)} 
                onCompetitorAdded={(newComp: any) => {
                  setCompetitors(prev => [...prev, newComp].sort((a, b) => a.apellido.localeCompare(b.apellido)));
                  setShowAddCompetitorModal(false);
                }} 
              />
            )}
          </div>
        ) : (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Listado de Equipos Existentes */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] w-80">Equipo e Integrantes</th>
                      {teamMods.map(mod => (
                        <th key={mod.id} className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] text-center min-w-[140px]">
                          {mod.label}
                        </th>
                      ))}
                      <th className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {uniqueTeams.length === 0 ? (
                      <tr>
                        <td colSpan={teamMods.length + 2} className="p-20 text-center">
                          <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                              <Trophy size={32} />
                            </div>
                            <p className="text-slate-400 font-bold italic tracking-wide">No has creado equipos para este torneo.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      uniqueTeams.map(team => {
                        const isEditing = editingTeamName === team.nombre_equipo;
                        const hasEnrollments = (teamEnrollments[team.nombre_equipo]?.size || 0) > 0;
                        const members = teamMembers[team.nombre_equipo] || [];
                        
                        return (
                          <tr key={team.id} className={`group transition-all duration-300 ${isEditing ? 'bg-blue-50/30' : 'hover:bg-slate-50/50'}`}>
                            <td className="p-6 align-top">
                              <div className="mb-4">
                                <div className="font-black text-slate-900 text-xl leading-tight mb-2 uppercase tracking-tight">{team.nombre_equipo}</div>
                                <div className="flex gap-2">
                                  <span className="text-[9px] bg-slate-100 px-2 py-0.5 rounded-full font-black text-slate-500 uppercase tracking-widest">{team.division_edad}</span>
                                  <span className="text-[9px] bg-blue-600 px-2 py-0.5 rounded-full font-black text-white uppercase tracking-widest shadow-sm shadow-blue-200">{team.genero}</span>
                                </div>
                              </div>
                              
                              {/* Gestión de Integrantes Unificada */}
                              <div className="space-y-1.5 max-w-[280px]">
                                {members.map(m => (
                                  <div key={m.competitor_id} className="flex items-center justify-between gap-3 bg-white px-3 py-2 rounded-xl border border-slate-100 text-[11px] group/member hover:border-blue-200 transition-colors shadow-sm">
                                    <span className="text-slate-700 font-bold uppercase tracking-tight">{m.competitors.apellido}, {m.competitors.nombre}</span>
                                    <button 
                                      onClick={() => handleRemoveMemberFromTeam(team.nombre_equipo, m.competitor_id)}
                                      className="text-red-400 hover:text-red-600 opacity-0 group-hover/member:opacity-100 transition-all p-1 hover:bg-red-50 rounded-lg"
                                      title="Quitar del equipo"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                ))}
                                <div className="relative">
                                  <select 
                                    className="w-full mt-2 pl-3 pr-8 py-2 text-[11px] font-black uppercase tracking-widest border border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-slate-400 outline-none focus:border-blue-400 focus:text-blue-600 focus:bg-white transition-all appearance-none cursor-pointer"
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        handleAddMemberToTeam(team.nombre_equipo, e.target.value);
                                        e.target.value = '';
                                      }
                                    }}
                                    value=""
                                  >
                                    <option value="">+ AGREGAR INTEGRANTE</option>
                                    {competitors
                                      .filter(c => !members.some(m => m.competitor_id === c.id))
                                      .map(c => (
                                        <option key={c.id} value={c.id}>{c.apellido.toUpperCase()}, {c.nombre.toUpperCase()}</option>
                                      ))
                                    }
                                  </select>
                                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                                    <UserPlus size={14} />
                                  </div>
                                </div>
                              </div>
                            </td>
                            
                            {teamMods.map(mod => {
                              const isEnrolled = isEditing 
                                ? tempTeamEnrollments.has(mod.id)
                                : teamEnrollments[team.nombre_equipo]?.has(mod.id);
                              
                              return (
                                <td key={mod.id} className="p-6 text-center align-top pt-8">
                                  <div className="flex justify-center">
                                    <label className={`relative flex items-center justify-center w-10 h-10 rounded-2xl border-2 transition-all duration-300 ${
                                      isEnrolled 
                                      ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-200 scale-110' 
                                      : isEditing 
                                        ? 'border-slate-200 hover:border-blue-400 cursor-pointer bg-white' 
                                        : 'border-slate-100 bg-slate-50/50'
                                    }`}>
                                      <input 
                                        type="checkbox"
                                        checked={!!isEnrolled}
                                        disabled={!isEditing}
                                        onChange={() => toggleTempTeamModality(mod.id)}
                                        className="hidden"
                                      />
                                      {isEnrolled && <CheckCircle2 size={22} strokeWidth={3} />}
                                    </label>
                                  </div>
                                </td>
                              );
                            })}

                            <td className="p-6 text-right align-top pt-8">
                              <div className="flex gap-3 justify-end">
                                {isEditing ? (
                                  <>
                                    <button 
                                      onClick={() => setEditingTeamName(null)}
                                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                                      disabled={isSaving}
                                    >
                                      <X size={20} />
                                    </button>
                                    <button 
                                      onClick={() => handleSaveTeam(team.nombre_equipo)}
                                      className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 active:scale-95 transition-all"
                                      disabled={isSaving}
                                    >
                                      {isSaving ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                      ) : (
                                        <>
                                          <Save size={16} />
                                          GUARDAR
                                        </>
                                      )}
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button 
                                      onClick={() => handleDeleteTeam(team.nombre_equipo)}
                                      className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                      title="Eliminar equipo"
                                    >
                                      <Trash2 size={20} />
                                    </button>
                                    <button 
                                      onClick={() => handleEditTeam(team)}
                                      className="flex items-center gap-2 px-6 py-2.5 text-blue-600 border-2 border-blue-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-50 transition-all duration-300"
                                    >
                                      EDITAR
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Formulario de Nuevo Equipo - Card Redesign */}
            {isAddingTeam ? (
              <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-blue-900/5 border border-blue-100 animate-in fade-in zoom-in duration-300 max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                    <Trophy size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Nuevo Equipo</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Configura los detalles de tu equipo</p>
                  </div>
                </div>

                <form onSubmit={handleCreateTeam} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Nombre del equipo</label>
                    <input 
                      type="text" 
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300"
                      placeholder="Ej: DRAGONES DEL SUR"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">División Edad</label>
                    <div className="relative">
                      <select 
                        value={newTeamAge}
                        onChange={(e) => setNewTeamAge(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-700 appearance-none cursor-pointer"
                      >
                        <option value="PRE-INFANTIL">Pre-Infantil</option>
                        <option value="INFANTIL">Infantil</option>
                        <option value="CADETE">Cadete</option>
                        <option value="JUVENIL">Juvenil</option>
                        <option value="ADULTO">Adulto</option>
                        <option value="SENIOR">Senior</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Género</label>
                    <div className="relative">
                      <select 
                        value={newTeamGender}
                        onChange={(e) => setNewTeamGender(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-700 appearance-none cursor-pointer"
                      >
                        <option value="MASCULINO">Masculino</option>
                        <option value="FEMENINO">Femenino</option>
                        <option value="MIXTO">Mixto</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 ml-1">Modalidades de Inscripción</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {teamMods.map(mod => (
                        <label key={mod.id} className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all duration-300 cursor-pointer ${
                          tempTeamEnrollments.has(mod.id)
                          ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200'
                          : 'bg-white border-slate-100 hover:border-blue-200 text-slate-600'
                        }`}>
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                            tempTeamEnrollments.has(mod.id) ? 'bg-white border-white text-blue-600' : 'border-slate-200'
                          }`}>
                            {tempTeamEnrollments.has(mod.id) && <CheckCircle2 size={16} strokeWidth={3} />}
                          </div>
                          <input 
                            type="checkbox"
                            checked={tempTeamEnrollments.has(mod.id)}
                            onChange={() => toggleTempTeamModality(mod.id)}
                            className="hidden"
                          />
                          <span className="text-sm font-black uppercase tracking-widest">{mod.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="md:col-span-2 flex justify-end items-center gap-6 mt-6 pt-6 border-t border-slate-50">
                    <button 
                      type="button" 
                      onClick={() => { setIsAddingTeam(false); setTempTeamEnrollments(new Set()); }}
                      className="text-sm font-black text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      className="px-10 py-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-200 transition-all active:scale-95 flex items-center gap-3"
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Plus size={20} />
                          Crear Equipo
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="flex justify-center">
                <button 
                  onClick={() => { setIsAddingTeam(true); setTempTeamEnrollments(new Set()); }}
                  className="group flex flex-col items-center gap-4 px-16 py-12 border-2 border-dashed border-slate-200 rounded-[3rem] text-slate-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/30 transition-all duration-500 bg-white/50"
                >
                  <div className="w-16 h-16 rounded-2xl bg-slate-50 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center transition-all duration-500 shadow-sm group-hover:shadow-xl group-hover:shadow-blue-200 group-hover:-translate-y-1">
                    <Plus size={32} />
                  </div>
                  <div className="text-center">
                    <span className="block text-sm font-black uppercase tracking-[0.2em] mb-1">Crear un nuevo equipo</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Para este torneo específico</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
