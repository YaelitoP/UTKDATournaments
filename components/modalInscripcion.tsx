'use client';
import { useForm } from 'react-hook-form';
import { supabase } from '../utils/supabase/supabaseClient';
import { useAuth } from './authContext'; // Usa tu contexto de autenticación

type FormValues = {
  nombre: string;
  apellido: string;
  sexo: string;
  fecha_nacimiento: string;
  cinturón_tipo: string;
  cinturón_grado: number;
  documento: string;
};

type ModalProps = {
  closeModal: () => void;
  onCompetitorAdded: (competidor: any) => void; // Nueva prop para actualizar la lista
};

const sexos = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
];

const tiposCinturon = [
  { value: 'GUP', label: 'Gup (colores)' },
  { value: 'DAN', label: 'Dan (negro)' },
];

export default function Modal({ closeModal, onCompetitorAdded }: ModalProps) {
  const { register, handleSubmit, watch, formState: { errors }, reset } = useForm<FormValues>();
  const { user } = useAuth(); // Usando el contexto para obtener el usuario autenticado
  const tipoSeleccionado = watch('cinturón_tipo');

  const onSubmit = async (data: FormValues) => {
    const coach_id = user?.id;

    if (!coach_id) {
      console.error('Usuario no autenticado');
      return;
    }

    const documentoRaw = data.documento.trim();
    const document_number_norm = documentoRaw.replace(/\D/g, '');

    const { data: newCompetidor, error } = await supabase
      .from('competitors')
      .insert([{
        nombre: data.nombre,
        apellido: data.apellido,
        sexo: data.sexo,
        fecha_nacimiento: data.fecha_nacimiento,
        cinturón_tipo: data.cinturón_tipo,
        cinturón_grado: data.cinturón_grado,
        documento: documentoRaw,
        document_number_norm,
        coach_id,
      }])
      .select()
      .single(); // Utilizamos single para obtener el registro insertado

    if (error) {
      console.error('Error al inscribir competidor:', error.message);
    } else {
      // Llamamos a la función para agregar el nuevo competidor a la lista
      onCompetitorAdded(newCompetidor);
      reset();
      closeModal();
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-600 bg-opacity-50">
      <div className="bg-white p-6 rounded-md shadow-md w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Inscribir competidor</h2>
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Campo Nombre */}
          <div className="mb-4">
            <label htmlFor="nombre" className="block font-medium">Nombre</label>
            <input
              id="nombre"
              type="text"
              {...register('nombre', { required: true })}
              className="w-full p-2 border border-gray-300 rounded"
            />
            {errors.nombre && <p className="text-red-500">Este campo es obligatorio</p>}
          </div>

          {/* Campo Apellido */}
          <div className="mb-4">
            <label htmlFor="apellido" className="block font-medium">Apellido</label>
            <input
              id="apellido"
              type="text"
              {...register('apellido', { required: true })}
              className="w-full p-2 border border-gray-300 rounded"
            />
            {errors.apellido && <p className="text-red-500">Este campo es obligatorio</p>}
          </div>

          {/* Campo Fecha de nacimiento */}
          <div className="mb-4">
            <label htmlFor="fecha_nacimiento" className="block font-medium">Fecha de nacimiento</label>
            <input
              id="fecha_nacimiento"
              type="date"
              {...register('fecha_nacimiento', { required: true })}
              className="w-full p-2 border border-gray-300 rounded"
            />
            {errors.fecha_nacimiento && <p className="text-red-500">Este campo es obligatorio</p>}
          </div>

          {/* Campo Sexo */}
          <div className="mb-4">
            <label htmlFor="sexo" className="block font-medium">Sexo</label>
            <select
              id="sexo"
              {...register('sexo', { required: true })}
              className="w-full p-2 border border-gray-300 rounded"
            >
              <option value="">Selecciona sexo</option>
              {sexos.map((sexo) => (
                <option key={sexo.value} value={sexo.value}>
                  {sexo.label}
                </option>
              ))}
            </select>
            {errors.sexo && <p className="text-red-500">Este campo es obligatorio</p>}
          </div>

          {/* Campo Documento / DNI */}
          <div className="mb-4">
            <label htmlFor="documento" className="block font-medium">
              Número de documento (DNI)
            </label>
            <input
              id="documento"
              type="text"
              {...register('documento', { required: true })}
              className="w-full p-2 border border-gray-300 rounded"
            />
            {errors.documento && (
              <p className="text-red-500">Este campo es obligatorio</p>
            )}
          </div>

          {/* Campo Tipo de cinturón */}
          <div className="mb-4">
            <label htmlFor="cinturón_tipo" className="block font-medium">Tipo de cinturón</label>
            <select
              id="cinturón_tipo"
              {...register('cinturón_tipo', { required: true })}
              className="w-full p-2 border border-gray-300 rounded"
            >
              <option value="">Selecciona tipo</option>
              {tiposCinturon.map((tipo) => (
                <option key={tipo.value} value={tipo.value}>
                  {tipo.label}
                </option>
              ))}
            </select>
            {errors.cinturón_tipo && <p className="text-red-500">Este campo es obligatorio</p>}
          </div>

          {/* Campo Grado de cinturón */}
          {tipoSeleccionado && (
            <div className="mb-4">
              <label htmlFor="cinturón_grado" className="block font-medium">
                Grado de cinturón ({tipoSeleccionado === 'DAN' ? '1 a 9' : '1 a 10'})
              </label>
              <input
                id="cinturón_grado"
                type="number"
                min={1}
                max={tipoSeleccionado === 'DAN' ? 9 : 10}
                {...register('cinturón_grado', { required: true })}
                className="w-full p-2 border border-gray-300 rounded"
              />
              {errors.cinturón_grado && (
                <p className="text-red-500">
                  Este campo es obligatorio y debe respetar el rango del tipo de cinturón
                </p>
              )}
            </div>
          )}

          <div className="flex justify-between">
            <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-md">
              Inscribir
            </button>
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 bg-red-500 text-white rounded-md"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}