import { create } from 'zustand';

export interface CoachProfile {
  user_id: string;
  username: string;
  nombre: string | null;
  apellido: string | null;
  pais: string | null;
  country_code: string | null;
  documento: string | null;
  document_number_norm: string | null;
  fecha_nacimiento: string | null;
  escuela: string | null;
  maestro_granmaestro: string | null;
  categoria_actual: string | null;
}

interface DataStore {
  coachProfile: CoachProfile | null;
  setCoachProfile: (profile: CoachProfile | null) => void;
  clearStore: () => void;
}

// Zustand solo como "memoria" de datos ya validados
export const useDataStore = create<DataStore>((set) => ({
  coachProfile: null,
  setCoachProfile: (coachProfile) => set({ coachProfile }),
  clearStore: () => set({ coachProfile: null }),
}));
