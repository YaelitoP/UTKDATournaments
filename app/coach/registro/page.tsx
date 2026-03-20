'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/authContext';
import { supabase } from '@/utils/supabase/supabaseClient';
import { useDataStore, CoachProfile } from '@/store/dataStore';

type CoachProfileForm = {
  country_code: string;
  documento: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento: string;
  escuela: string;
  maestro_granmaestro: string;
  categoria_actual: string;
};

const COUNTRIES = [
  { code: 'ARG', label: 'Argentina' },
  { code: 'URU', label: 'Uruguay' },
  { code: 'BRA', label: 'Brasil' },
  { code: 'CHL', label: 'Chile' },
  { code: 'PAR', label: 'Paraguay' },
  { code: 'BOL', label: 'Bolivia' },
  { code: 'PER', label: 'Perú' },
  { code: 'COL', label: 'Colombia' },
  { code: 'VEN', label: 'Venezuela' },
  { code: 'MEX', label: 'México' },
  { code: 'ESP', label: 'España' },
];

const CATEGORIAS = [
  'Sabom (1-3 Dan)',
  'Sabom-Nim (4-6 Dan)',
  'Sahyun-Nim (7-8 Dan)',
  'Saseong-Nim (9 Dan)',
  'Maestro',
  'Gran Maestro',
];

export default function CoachRegistroPage() {
  const { user, loading, coachProfile, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get('mode') === 'edit';
  const [isInitializing, setIsInitializing] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    reset,
  } = useForm<CoachProfileForm>();

  const selectedCountryCode = watch('country_code');

  const handleSignOut = async () => {
    console.log("CoachRegistro: handleSignOut clicked");
    try {
      await signOut();
      console.log("CoachRegistro: signOut completed, redirecting...");
      router.replace('/');
    } catch (error) {
      console.error('CoachRegistro: Error cerrando sesión:', error);
      router.replace('/');
    }
  };

  // Pre-cargar datos si estamos en modo edición o si el perfil ya existe
  useEffect(() => {
    if (loading) return;
    
    if (!user) {
      router.replace('/');
      return;
    }

    if (coachProfile) {
      if (!isEditMode) {
        // Si no es modo edición y ya tiene perfil, al dashboard
        router.replace('/dashboard');
        return;
      }
      
      // Si es modo edición, cargamos los valores
      reset({
        nombre: coachProfile.nombre || '',
        apellido: coachProfile.apellido || '',
        fecha_nacimiento: coachProfile.fecha_nacimiento || '',
        country_code: coachProfile.country_code || '',
        documento: coachProfile.documento || '',
        escuela: coachProfile.escuela || '',
        maestro_granmaestro: coachProfile.maestro_granmaestro || '',
        categoria_actual: coachProfile.categoria_actual || '',
      });
    }
    setIsInitializing(false);
  }, [user, loading, coachProfile, router, isEditMode, reset]);

  const onSubmit = async (data: CoachProfileForm) => {
    if (!user) return;

    const countryCode = data.country_code.toUpperCase();
    const docNorm = data.documento.replace(/\D/g, '');
    const trimmedDoc = docNorm.slice(0, 12); 
    const countryLabel = COUNTRIES.find(c => c.code === countryCode)?.label || countryCode;

    if (trimmedDoc.length < 6) {
      alert('El número de documento debe tener al menos 6 dígitos.');
      return;
    }

    const username = `${countryCode}-${trimmedDoc}`;

    try {
      console.log(`CoachRegistro: ${isEditMode ? 'Actualizando' : 'Creando'} perfil...`, { user_id: user.id, username });
      
      const profileData = {
        user_id: user.id,
        username,
        nombre: data.nombre,
        apellido: data.apellido,
        pais: countryLabel,
        country_code: countryCode,
        documento: data.documento,
        document_number_norm: trimmedDoc,
        fecha_nacimiento: data.fecha_nacimiento,
        escuela: data.escuela,
        maestro_granmaestro: data.maestro_granmaestro,
        categoria_actual: data.categoria_actual,
      };

      const { data: profileResult, error } = isEditMode 
        ? await supabase.from('coach_profiles').update(profileData).eq('user_id', user.id).select().single()
        : await supabase.from('coach_profiles').insert([profileData]).select().single();

      if (error) {
        console.error('Error al guardar coach_profile:', error.message);
        if (error.code === '23505' && !isEditMode) {
          alert('Ya existe un perfil asociado a este usuario o documento.');
        } else {
          alert(`No se pudo guardar el perfil: ${error.message}`);
        }
        return;
      }

      console.log(`CoachRegistro: Perfil ${isEditMode ? 'actualizado' : 'creado'} con éxito`);
      
      // Actualizamos el store de Zustand para que el Dashboard vea el cambio de inmediato
      if (profileResult) {
        useDataStore.getState().setCoachProfile(profileResult as CoachProfile);
      }
      
      router.replace('/dashboard');
    } catch (e) {
      console.error(e);
      alert('Ocurrió un error inesperado.');
    }
  };

  if (!loading && !user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4 py-12">
      {(loading || isInitializing) ? (
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 text-sm font-medium">Verificando perfil...</p>
        </div>
      ) : (
        <div className="max-w-2xl w-full bg-white p-8 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              {isEditMode ? 'Editar mi perfil' : 'Completar perfil de coach'}
            </h2>
            <div className="flex gap-4 items-center">
              {isEditMode && (
                <button
                  onClick={() => router.back()}
                  className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
                >
                  Volver
                </button>
              )}
              <button
                onClick={handleSignOut}
                className="text-sm text-red-600 hover:text-red-800 font-medium transition-colors"
              >
                Cerrar sesión
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Nombre */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nombre</label>
                <input
                  {...register('nombre', { required: 'El nombre es obligatorio' })}
                  className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none ${errors.nombre ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Ej: Juan"
                />
                {errors.nombre && <p className="text-red-500 text-xs mt-1">{errors.nombre.message}</p>}
              </div>

              {/* Apellido */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Apellido</label>
                <input
                  {...register('apellido', { required: 'El apellido es obligatorio' })}
                  className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none ${errors.apellido ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Ej: Pérez"
                />
                {errors.apellido && <p className="text-red-500 text-xs mt-1">{errors.apellido.message}</p>}
              </div>

              {/* País */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">País</label>
                <select
                  {...register('country_code', { required: 'El país es obligatorio' })}
                  className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none ${errors.country_code ? 'border-red-500' : 'border-gray-300'}`}
                >
                  <option value="">Seleccionar país...</option>
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                {errors.country_code && <p className="text-red-500 text-xs mt-1">{errors.country_code.message}</p>}
              </div>

              {/* Documento */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Documento / ID</label>
                <input
                  {...register('documento', { 
                    required: 'El documento es obligatorio',
                    minLength: { value: 6, message: 'Mínimo 6 caracteres' }
                  })}
                  className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none ${errors.documento ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Número de identificación"
                />
                {errors.documento && <p className="text-red-500 text-xs mt-1">{errors.documento.message}</p>}
              </div>

              {/* Fecha Nacimiento */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Fecha de Nacimiento</label>
                <input
                  type="date"
                  {...register('fecha_nacimiento', { required: 'La fecha es obligatoria' })}
                  className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none ${errors.fecha_nacimiento ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.fecha_nacimiento && <p className="text-red-500 text-xs mt-1">{errors.fecha_nacimiento.message}</p>}
              </div>

              {/* Escuela */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Escuela / Dojang</label>
                <input
                  {...register('escuela', { required: 'La escuela es obligatoria' })}
                  className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none ${errors.escuela ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Nombre de tu escuela"
                />
                {errors.escuela && <p className="text-red-500 text-xs mt-1">{errors.escuela.message}</p>}
              </div>

              {/* Maestro */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Maestro / Gran Maestro</label>
                <input
                  {...register('maestro_granmaestro', { required: 'Este campo es obligatorio' })}
                  className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none ${errors.maestro_granmaestro ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Tu instructor a cargo"
                />
                {errors.maestro_granmaestro && <p className="text-red-500 text-xs mt-1">{errors.maestro_granmaestro.message}</p>}
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Categoría Actual</label>
                <select
                  {...register('categoria_actual', { required: 'La categoría es obligatoria' })}
                  className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none ${errors.categoria_actual ? 'border-red-500' : 'border-gray-300'}`}
                >
                  <option value="">Seleccionar categoría...</option>
                  {CATEGORIAS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {errors.categoria_actual && <p className="text-red-500 text-xs mt-1">{errors.categoria_actual.message}</p>}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-700 transition-colors shadow-md ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? 'Guardando...' : (isEditMode ? 'Guardar Cambios' : 'Completar Registro')}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}


