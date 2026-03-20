'use client'
import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/components/authContext';
import { supabase } from '@/utils/supabase/supabaseClient';
import Modal from '@/components/modalInscripcion';

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
    <div className="p-6 max-w-6xl mx-auto min-h-screen bg-gray-50">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <button 
            onClick={() => router.push('/torneos')}
            className="mb-4 text-blue-600 hover:underline flex items-center gap-2 font-medium"
          >
            ← Volver a torneos
          </button>
          <h1 className="text-3xl font-bold text-gray-900">{tournament?.nombre}</h1>
          <p className="text-gray-600">Fecha: {tournament ? new Date(tournament.fecha).toLocaleDateString() : ''}</p>
        </div>
        
        <div className="flex bg-white p-1 rounded-lg border shadow-sm">
          <button 
            onClick={() => setActiveTab('individual')}
            className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'individual' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            Individual
          </button>
          <button 
            onClick={() => setActiveTab('teams')}
            className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'teams' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            Equipos
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border p-8 animate-pulse space-y-6">
          <div className="h-8 w-48 bg-gray-200 rounded"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-12 w-full bg-gray-100 rounded"></div>)}
          </div>
        </div>
      ) : activeTab === 'individual' ? (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="p-4 font-bold text-gray-500 uppercase text-xs tracking-wider sticky left-0 bg-gray-50 z-10">Competidor</th>
                  {individualMods.map(mod => (
                    <th key={mod.id} className="p-4 font-bold text-gray-500 uppercase text-xs tracking-wider text-center">
                      {mod.label}
                    </th>
                  ))}
                  <th className="p-4 font-bold text-gray-500 uppercase text-xs tracking-wider text-right sticky right-0 bg-gray-50 z-10">Gestión</th>
                </tr>
              </thead>
              <tbody>
                {competitors.length === 0 ? (
                  <tr>
                    <td colSpan={individualMods.length + 2} className="p-12 text-center text-gray-400 italic">
                      No tienes competidores registrados para inscribir.
                    </td>
                  </tr>
                ) : (
                  competitors.map(comp => {
                    const isEditing = editingId === comp.id;
                    const hasEnrollments = (enrollments[comp.id]?.size || 0) > 0;
                    
                    return (
                      <tr key={comp.id} className={`border-b transition-colors ${isEditing ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}>
                        <td className="p-4 sticky left-0 bg-inherit z-10">
                          <div className="font-bold text-gray-900">{comp.apellido}, {comp.nombre}</div>
                          <div className="text-[10px] text-blue-600 font-bold uppercase">{comp.cinturón_grado} {comp.cinturón_tipo}</div>
                        </td>
                        
                        {individualMods.map(mod => {
                          const isEnrolled = isEditing 
                            ? tempEnrollments.has(mod.id)
                            : enrollments[comp.id]?.has(mod.id);
                          
                          return (
                            <td key={mod.id} className="p-4 text-center">
                              <input 
                                type="checkbox"
                                checked={!!isEnrolled}
                                disabled={!isEditing}
                                onChange={() => toggleTempModality(mod.id)}
                                className={`w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-all ${isEditing ? 'cursor-pointer' : 'cursor-default opacity-70'}`}
                              />
                            </td>
                          );
                        })}

                        <td className="p-4 text-right sticky right-0 bg-inherit z-10">
                          {isEditing ? (
                            <div className="flex gap-2 justify-end">
                              <button 
                                onClick={() => setEditingId(null)}
                                className="text-xs font-bold text-gray-500 hover:text-gray-700"
                                disabled={isSaving}
                              >
                                Cancelar
                              </button>
                              <button 
                                onClick={() => handleSave(comp)}
                                className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50"
                                disabled={isSaving}
                              >
                                {isSaving ? '...' : (tempEnrollments.size === 0 ? 'Eliminar' : 'Guardar')}
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => handleEdit(comp)}
                              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${hasEnrollments ? 'text-blue-600 border border-blue-600 hover:bg-blue-50' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'}`}
                            >
                              {hasEnrollments ? 'Editar' : 'Inscribir'}
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

          <div className="mt-8 flex justify-center">
            <button 
              onClick={() => setShowAddCompetitorModal(true)}
              className="px-8 py-3 border-2 border-dashed border-gray-300 text-gray-500 rounded-xl hover:border-blue-400 hover:text-blue-600 transition-all font-bold flex items-center gap-2 bg-white/50"
            >
              <span className="text-lg">+</span> Agregar un nuevo competidor
            </button>
          </div>

          {showAddCompetitorModal && (
            <Modal 
              closeModal={() => setShowAddCompetitorModal(false)} 
              onCompetitorAdded={(newComp: any) => {
                setCompetitors(prev => [...prev, newComp].sort((a, b) => a.apellido.localeCompare(b.apellido)));
                setShowAddCompetitorModal(false);
              }} 
            />
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Listado de Equipos Existentes */}
          <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="p-4 font-bold text-gray-500 uppercase text-xs tracking-wider">Equipo</th>
                  {teamMods.map(mod => (
                    <th key={mod.id} className="p-4 font-bold text-gray-500 uppercase text-xs tracking-wider text-center">
                      {mod.label}
                    </th>
                  ))}
                  <th className="p-4 font-bold text-gray-500 uppercase text-xs tracking-wider text-right">Gestión</th>
                </tr>
              </thead>
              <tbody>
                {uniqueTeams.length === 0 ? (
                  <tr>
                    <td colSpan={teamMods.length + 2} className="p-12 text-center text-gray-400 italic">
                      No has creado equipos para este torneo.
                    </td>
                  </tr>
                ) : (
                  uniqueTeams.map(team => {
                    const isEditing = editingTeamName === team.nombre_equipo;
                    const hasEnrollments = (teamEnrollments[team.nombre_equipo]?.size || 0) > 0;
                    const members = teamMembers[team.nombre_equipo] || [];
                    
                    return (
                      <tr key={team.id} className={`border-b transition-colors ${isEditing ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}>
                        <td className="p-4">
                          <div className="font-bold text-gray-900">{team.nombre_equipo}</div>
                          <div className="flex gap-2 mt-1 mb-2">
                            <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded font-bold text-gray-500 uppercase">{team.division_edad}</span>
                            <span className="text-[10px] bg-blue-50 px-1.5 py-0.5 rounded font-bold text-blue-600 uppercase border border-blue-100">{team.genero}</span>
                          </div>
                          
                          {/* Gestión de Integrantes Unificada */}
                          <div className="space-y-1">
                            {members.map(m => (
                              <div key={m.competitor_id} className="flex items-center justify-between gap-2 bg-white px-2 py-1 rounded border border-gray-100 text-[10px] group/member">
                                <span className="text-gray-600 font-medium">{m.competitors.apellido}, {m.competitors.nombre}</span>
                                <button 
                                  onClick={() => handleRemoveMemberFromTeam(team.nombre_equipo, m.competitor_id)}
                                  className="text-red-400 hover:text-red-600 opacity-0 group-hover/member:opacity-100 transition-opacity"
                                >
                                  Quitar
                                </button>
                              </div>
                            ))}
                            <select 
                              className="w-full mt-2 p-1 text-[10px] border border-dashed rounded bg-transparent text-gray-400 outline-none focus:border-blue-400 focus:text-blue-600 transition-colors"
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleAddMemberToTeam(team.nombre_equipo, e.target.value);
                                  e.target.value = '';
                                }
                              }}
                              value=""
                            >
                              <option value="">+ Agregar integrante</option>
                              {competitors
                                .filter(c => !members.some(m => m.competitor_id === c.id))
                                .map(c => (
                                  <option key={c.id} value={c.id}>{c.apellido}, {c.nombre}</option>
                                ))
                              }
                            </select>
                          </div>
                        </td>
                        
                        {teamMods.map(mod => {
                          const isEnrolled = isEditing 
                            ? tempTeamEnrollments.has(mod.id)
                            : teamEnrollments[team.nombre_equipo]?.has(mod.id);
                          
                          return (
                            <td key={mod.id} className="p-4 text-center">
                              <input 
                                type="checkbox"
                                checked={!!isEnrolled}
                                disabled={!isEditing}
                                onChange={() => toggleTempTeamModality(mod.id)}
                                className={`w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-all ${isEditing ? 'cursor-pointer' : 'cursor-default opacity-70'}`}
                              />
                            </td>
                          );
                        })}

                        <td className="p-4 text-right">
                          <div className="flex gap-2 justify-end">
                            {isEditing ? (
                              <>
                                <button 
                                  onClick={() => setEditingTeamName(null)}
                                  className="text-xs font-bold text-gray-500 hover:text-gray-700"
                                  disabled={isSaving}
                                >
                                  Cancelar
                                </button>
                                <button 
                                  onClick={() => handleSaveTeam(team.nombre_equipo)}
                                  className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50"
                                  disabled={isSaving}
                                >
                                  {isSaving ? '...' : 'Guardar'}
                                </button>
                              </>
                            ) : (
                              <>
                                <button 
                                  onClick={() => handleDeleteTeam(team.nombre_equipo)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                                  title="Eliminar equipo"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                </button>
                                <button 
                                  onClick={() => handleEditTeam(team)}
                                  className="px-4 py-1.5 text-blue-600 border border-blue-600 rounded-md text-xs font-bold hover:bg-blue-50 transition-all"
                                >
                                  Editar
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

          {/* Formulario de Nuevo Equipo */}
          {isAddingTeam ? (
            <div className="bg-white p-8 rounded-xl shadow-md border-2 border-blue-500 animate-in fade-in zoom-in duration-200">
              <h3 className="text-lg font-bold text-gray-900 mb-6">Nuevo Equipo</h3>
              <form onSubmit={handleCreateTeam} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Nombre del equipo</label>
                  <input 
                    type="text" 
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ej: Los Guerreros"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">División Edad</label>
                  <select 
                    value={newTeamAge}
                    onChange={(e) => setNewTeamAge(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="PRE-INFANTIL">Pre-Infantil</option>
                    <option value="INFANTIL">Infantil</option>
                    <option value="CADETE">Cadete</option>
                    <option value="JUVENIL">Juvenil</option>
                    <option value="ADULTO">Adulto</option>
                    <option value="SENIOR">Senior</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Género</label>
                  <select 
                    value={newTeamGender}
                    onChange={(e) => setNewTeamGender(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="MASCULINO">Masculino</option>
                    <option value="FEMENINO">Femenino</option>
                    <option value="MIXTO">Mixto</option>
                  </select>
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-3">Inscribir en Modalidades</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {teamMods.map(mod => (
                      <label key={mod.id} className="flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                        <input 
                          type="checkbox"
                          checked={tempTeamEnrollments.has(mod.id)}
                          onChange={() => toggleTempTeamModality(mod.id)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm font-medium text-gray-700">{mod.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2 flex justify-end gap-3 mt-4">
                  <button 
                    type="button" 
                    onClick={() => { setIsAddingTeam(false); setTempTeamEnrollments(new Set()); }}
                    className="px-6 py-2.5 text-gray-500 font-bold hover:text-gray-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="px-8 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-md shadow-blue-200 transition-all active:scale-95"
                    disabled={isSaving}
                  >
                    {isSaving ? 'Guardando...' : 'Crear Equipo e Inscribir'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <button 
              onClick={() => { setIsAddingTeam(true); setTempTeamEnrollments(new Set()); }}
              className="w-full py-12 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 hover:border-blue-400 hover:text-blue-600 hover:bg-white transition-all font-bold flex flex-col items-center gap-2"
            >
              <span className="text-2xl">+</span>
              Crear un nuevo equipo para este torneo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
