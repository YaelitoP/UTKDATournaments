'use client'
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/components/authContext';
import { supabase } from '@/utils/supabase/supabaseClient';
import Modal from '@/components/modalInscripcion';

type Competitor = {
  id: string;
  nombre: string;
  apellido: string;
  documento: string | null;
  sexo: string;
  fecha_nacimiento: string;
  cinturón_tipo: string;
  cinturón_grado: number;
};

type Enrollment = {
  id: string;
  competitor_id: string;
  status: 'ACTIVA' | 'CANCELADA';
};

type Tournament = {
  id: string;
  nombre: string;
};

type Modality = {
  id: string;
  label: string;
  requires_weight: boolean;
};

export default function IndividualEnrollmentPage() {
  const { id: tournamentId, modalityId } = useParams();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [enrollments, setEnrollments] = useState<Record<string, Enrollment>>({});
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [modality, setModality] = useState<Modality | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const { user, loading: authLoading, coachProfile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    // Escalera de dependencias: Esperamos a tener el perfil cargado
    if (authLoading || !user || !coachProfile || !tournamentId || !modalityId) return;

    const fetchData = async () => {
      setLoading(true);

      // Fetch tournament and modality info
      const [tRes, mRes] = await Promise.all([
        supabase.from('tournaments').select('id, nombre').eq('id', tournamentId).single(),
        supabase.from('modalities').select('id, label, requires_weight').eq('id', modalityId).single()
      ]);

      setTournament(tRes.data);
      setModality(mRes.data);

      // Fetch coach's competitors
      const { data: compData } = await supabase
        .from('competitors')
        .select('*')
        .eq('coach_id', user.id)
        .order('apellido', { ascending: true });

      setCompetitors(compData ?? []);

      // Fetch existing enrollments for this tournament and modality
      const { data: enrollData, error: enrollError } = await supabase
        .from('individual_entries')
        .select('id, competitor_id, status')
        .eq('tournament_id', tournamentId)
        .eq('modality_id', modalityId);

      if (enrollError) {
        console.error('Enrollment: Error fetching enrollments:', enrollError);
      }

      const enrollmentMap: Record<string, Enrollment> = {};
      enrollData?.forEach(e => {
        enrollmentMap[e.competitor_id] = e;
      });
      setEnrollments(enrollmentMap);

      setLoading(false);
    };

    fetchData();
  }, [user, authLoading, coachProfile, tournamentId, modalityId]);

  const handleEnroll = async (competitor: Competitor) => {
    if (!user || !tournamentId || !modalityId) return;

    const existing = enrollments[competitor.id];

    if (existing) {
      // Toggle status or delete? Usually, delete or cancel.
      // For simplicity, let's toggle between ACTIVA and CANCELADA if status exists, or delete.
      // The schema says status defaults to 'ACTIVA'.
      const { error } = await supabase
        .from('individual_entries')
        .delete()
        .eq('id', existing.id);

      if (error) {
        alert('Error al cancelar inscripción: ' + error.message);
      } else {
        const newEnrollments = { ...enrollments };
        delete newEnrollments[competitor.id];
        setEnrollments(newEnrollments);
      }
    } else {
      // Enroll
      const { data, error } = await supabase
        .from('individual_entries')
        .insert([{
          tournament_id: tournamentId,
          coach_id: user.id,
          competitor_id: competitor.id,
          modality_id: modalityId,
          status: 'ACTIVA',
          // Snapshots are handled by the trigger in DB
          snap_nombre: competitor.nombre,
          snap_apellido: competitor.apellido,
          snap_sexo: competitor.sexo,
          snap_fecha_nacimiento: competitor.fecha_nacimiento,
          snap_cinturón_tipo: competitor.cinturón_tipo,
          snap_cinturón_grado: competitor.cinturón_grado
        }])
        .select()
        .single();

      if (error) {
        alert('Error al inscribir: ' + error.message);
      } else {
        setEnrollments({ ...enrollments, [competitor.id]: data });
      }
    }
  };

  const handleCompetitorAdded = (newComp: Competitor) => {
    setCompetitors(prev => [...prev, newComp].sort((a, b) => a.apellido.localeCompare(b.apellido)));
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
            <h2 className="text-xl text-gray-700">Inscripción Individual: <span className="text-blue-600 font-semibold">{modality?.label}</span></h2>
          </>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="p-4 font-bold text-gray-500 uppercase text-xs tracking-wider">Competidor</th>
              <th className="p-4 font-bold text-gray-500 uppercase text-xs tracking-wider">Cinturón</th>
              <th className="p-4 font-bold text-gray-500 uppercase text-xs tracking-wider text-center">Estado</th>
              <th className="p-4 font-bold text-gray-500 uppercase text-xs tracking-wider text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1, 2, 3, 4, 5].map(i => (
                <tr key={i} className="border-b animate-pulse">
                  <td className="p-4"><div className="h-4 w-32 bg-gray-100 rounded"></div></td>
                  <td className="p-4"><div className="h-4 w-24 bg-gray-50 rounded"></div></td>
                  <td className="p-4 text-center"><div className="h-6 w-20 bg-gray-50 rounded-full mx-auto"></div></td>
                  <td className="p-4 text-right"><div className="h-8 w-24 bg-gray-50 rounded ml-auto"></div></td>
                </tr>
              ))
            ) : competitors.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-12 text-center text-gray-400 italic bg-white">
                  No tienes competidores registrados aún.
                </td>
              </tr>
            ) : (
              competitors.map(comp => {
                const isEnrolled = !!enrollments[comp.id];
                return (
                  <tr key={comp.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-gray-900">{comp.apellido}, {comp.nombre}</div>
                      <div className="text-xs text-gray-500">{comp.documento || 'Sin documento'}</div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded uppercase border border-blue-100">
                        {comp.cinturón_grado} {comp.cinturón_tipo}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {isEnrolled ? (
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full uppercase border border-green-200">
                          Inscripto
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-gray-100 text-gray-400 text-[10px] font-bold rounded-full uppercase border border-gray-200">
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleEnroll(comp)}
                        className={`px-4 py-1.5 rounded text-xs font-bold transition-all shadow-sm ${
                          isEnrolled 
                          ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white' 
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {isEnrolled ? 'Cancelar' : 'Inscribir'}
                      </button>
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
          onClick={() => setShowModal(true)}
          className="px-8 py-3 border-2 border-dashed border-gray-300 text-gray-500 rounded-xl hover:border-blue-400 hover:text-blue-600 transition-all font-bold flex items-center gap-2 bg-white/50"
        >
          <span className="text-lg">+</span> Agregar un nuevo competidor
        </button>
      </div>

      {showModal && (
        <Modal 
          closeModal={() => setShowModal(false)} 
          onCompetitorAdded={handleCompetitorAdded} 
        />
      )}
    </div>
  );
}
