'use client'
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/components/authContext';
import { supabase } from '@/utils/supabase/supabaseClient';

type Competitor = {
  id: string;
  nombre: string;
  apellido: string;
};

type Team = {
  id: string;
  nombre_equipo: string;
  division_edad: string;
  cinturón_tipo: string;
  cinturón_grado: number;
  genero: string;
  members: Competitor[];
};

type Tournament = {
  id: string;
  nombre: string;
};

type Modality = {
  id: string;
  label: string;
};

export default function TeamEnrollmentPage() {
  const { id: tournamentId, modalityId } = useParams();
  const [teams, setTeams] = useState<Team[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [modality, setModality] = useState<Modality | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Form states
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamAge, setNewTeamAge] = useState('ADULTO');
  const [newTeamBelt, setNewTeamBelt] = useState('DAN');
  const [newTeamGrade, setNewTeamGrade] = useState(1);
  const [newTeamGender, setNewTeamGender] = useState('MIXTO');
  const [isAddingTeam, setIsAddingTeam] = useState(false);

  const { user, loading: authLoading, coachProfile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    // Escalera de dependencias: No disparamos consultas si no tenemos perfil validado
    if (authLoading || !user || !coachProfile || !tournamentId || !modalityId) return;

    const fetchData = async () => {
      setLoading(true);

      const [tRes, mRes, cRes] = await Promise.all([
        supabase.from('tournaments').select('id, nombre').eq('id', tournamentId).single(),
        supabase.from('modalities').select('id, label').eq('id', modalityId).single(),
        supabase.from('competitors').select('id, nombre, apellido').eq('coach_id', user.id)
      ]);

      setTournament(tRes.data);
      setModality(mRes.data);
      setCompetitors(cRes.data ?? []);

      // Fetch teams and their members
      const { data: teamsData } = await supabase
        .from('teams')
        .select(`
          *,
          team_members (
            competitor_id,
            competitors (id, nombre, apellido)
          )
        `)
        .eq('tournament_id', tournamentId)
        .eq('modality_id', modalityId)
        .eq('coach_id', user.id);

      const formattedTeams = teamsData?.map((t: any) => ({
        ...t,
        members: t.team_members.map((tm: any) => tm.competitors)
      })) || [];

      setTeams(formattedTeams);
      setLoading(false);
    };

    fetchData();
  }, [user, authLoading, coachProfile, tournamentId, modalityId]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !tournamentId || !modalityId) return;

    const { data, error } = await supabase
      .from('teams')
      .insert([{
        tournament_id: tournamentId,
        coach_id: user.id,
        modality_id: modalityId,
        nombre_equipo: newTeamName,
        division_edad: newTeamAge,
        cinturón_tipo: newTeamBelt,
        cinturón_grado: newTeamGrade,
        genero: newTeamGender
      }])
      .select()
      .single();

    if (error) {
      alert('Error al crear equipo: ' + error.message);
    } else {
      setTeams([...teams, { ...data, members: [] }]);
      setIsAddingTeam(false);
      setNewTeamName('');
    }
  };

  const handleAddMember = async (teamId: string, competitorId: string) => {
    const { error } = await supabase
      .from('team_members')
      .insert([{ team_id: teamId, competitor_id: competitorId }]);

    if (error) {
      alert('Error al agregar miembro: ' + error.message);
    } else {
      // Refresh teams (or update state locally)
      const comp = competitors.find(c => c.id === competitorId);
      if (comp) {
        setTeams(teams.map(t => 
          t.id === teamId ? { ...t, members: [...t.members, comp] } : t
        ));
      }
    }
  };

  const handleRemoveMember = async (teamId: string, competitorId: string) => {
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('competitor_id', competitorId);

    if (error) {
      alert('Error al eliminar miembro: ' + error.message);
    } else {
      setTeams(teams.map(t => 
        t.id === teamId ? { ...t, members: t.members.filter(m => m.id !== competitorId) } : t
      ));
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este equipo?')) return;

    const { error } = await supabase.from('teams').delete().eq('id', teamId);

    if (error) {
      alert('Error al eliminar equipo: ' + error.message);
    } else {
      setTeams(teams.filter(t => t.id !== teamId));
    }
  };

  if (!authLoading && !user) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto min-h-screen bg-gray-50">
      <div className="mb-8">
        <button 
          onClick={() => router.push(`/torneos/${tournamentId}`)}
          className="mb-4 text-blue-600 hover:underline flex items-center gap-2 font-medium"
        >
          ← Volver a modalidades
        </button>
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-10 w-64 bg-gray-300 rounded"></div>
            <div className="h-6 w-48 bg-gray-200 rounded"></div>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-gray-900">{tournament?.nombre}</h1>
            <h2 className="text-xl text-gray-700">Inscripción por Equipo: <span className="text-blue-600 font-semibold">{modality?.label}</span></h2>
          </>
        )}
      </div>

      <div className="space-y-6">
        {loading ? (
          [1, 2].map(i => (
            <div key={i} className="bg-white p-6 rounded-xl shadow-sm border animate-pulse space-y-4">
              <div className="h-6 w-48 bg-gray-200 rounded"></div>
              <div className="h-4 w-32 bg-gray-100 rounded"></div>
              <div className="h-20 w-full bg-gray-50 rounded"></div>
            </div>
          ))
        ) : teams.length === 0 && !isAddingTeam ? (
          <div className="bg-white p-12 rounded-xl shadow-sm border text-center flex flex-col items-center">
            <p className="text-gray-500 font-medium italic">No has creado equipos para esta modalidad aún.</p>
          </div>
        ) : (
          teams.map(team => (
            <div key={team.id} className="bg-white p-6 rounded-xl shadow-sm border hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{team.nombre_equipo}</h3>
                  <div className="flex gap-2 mt-1">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded uppercase">
                      {team.division_edad}
                    </span>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded uppercase border border-blue-100">
                      {team.cinturón_grado} {team.cinturón_tipo}
                    </span>
                    <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-[10px] font-bold rounded uppercase border border-purple-100">
                      {team.genero}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => handleDeleteTeam(team.id)}
                  className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                  title="Eliminar equipo"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Integrantes del Equipo</h4>
                <div className="space-y-2">
                  {team.members.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">No hay integrantes en este equipo.</p>
                  ) : (
                    team.members.map(member => (
                      <div key={member.id} className="flex justify-between items-center bg-white p-2 rounded border border-gray-100 shadow-sm">
                        <span className="text-sm font-medium text-gray-700">{member.apellido}, {member.nombre}</span>
                        <button 
                          onClick={() => handleRemoveMember(team.id, member.id)}
                          className="text-xs text-red-500 hover:underline font-bold"
                        >
                          Quitar
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Add Member Dropdown */}
              <div className="flex gap-2">
                <select 
                  className="flex-1 p-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddMember(team.id, e.target.value);
                      e.target.value = '';
                    }
                  }}
                  value=""
                >
                  <option value="">+ Agregar integrante...</option>
                  {competitors
                    .filter(c => !team.members.some(m => m.id === c.id))
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.apellido}, {c.nombre}</option>
                    ))
                  }
                </select>
              </div>
            </div>
          ))
        )}

        {isAddingTeam ? (
          <div className="bg-gray-50 p-6 rounded-lg border-2 border-dashed border-gray-300">
            <h3 className="text-lg font-bold mb-4">Nuevo Equipo</h3>
            <form onSubmit={handleCreateTeam} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre del equipo</label>
                <input 
                  type="text" 
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">División Edad</label>
                <select 
                  value={newTeamAge}
                  onChange={(e) => setNewTeamAge(e.target.value)}
                  className="w-full p-2 border rounded"
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
                <label className="block text-sm font-medium mb-1">Tipo Cinturón</label>
                <select 
                  value={newTeamBelt}
                  onChange={(e) => setNewTeamBelt(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="GUP">Gup (Colores)</option>
                  <option value="DAN">Dan (Negros)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Grado (1-10)</label>
                <input 
                  type="number" 
                  min="1" 
                  max="10"
                  value={newTeamGrade}
                  onChange={(e) => setNewTeamGrade(parseInt(e.target.value))}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Género</label>
                <select 
                  value={newTeamGender}
                  onChange={(e) => setNewTeamGender(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="MASCULINO">Masculino</option>
                  <option value="FEMENINO">Femenino</option>
                  <option value="MIXTO">Mixto</option>
                </select>
              </div>
              <div className="md:col-span-2 flex justify-end gap-2 mt-4">
                <button 
                  type="button" 
                  onClick={() => setIsAddingTeam(false)}
                  className="px-4 py-2 text-gray-600"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold"
                >
                  Crear Equipo
                </button>
              </div>
            </form>
          </div>
        ) : (
          <button 
            onClick={() => setIsAddingTeam(true)}
            className="w-full py-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-all font-bold"
          >
            + Crear un nuevo equipo
          </button>
        )}
      </div>
    </div>
  );
}
