import { createContext, useContext, useState, useEffect, ReactNode, useMemo, useRef } from 'react';
import { supabase } from '../utils/supabase/supabaseClient';
import { useDataStore, CoachProfile } from '@/store/dataStore';

interface AuthContextType {
  user: any;
  loading: boolean;
  coachProfile: CoachProfile | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const renderCount = useRef(0);
  const isFetchingProfile = useRef<string | null>(null); // Guardamos el ID del usuario que se está buscando
  
  // Usamos el store solo como memoria de datos persistente
  const { coachProfile, setCoachProfile, clearStore } = useDataStore();

  renderCount.current++;
  console.log(`AuthProvider: [RENDER #${renderCount.current}] state:`, { 
    hasUser: !!user, 
    loading, 
    hasProfile: !!coachProfile 
  });

  useEffect(() => {
    let mounted = true;
    console.log("AuthProvider: [MOUNT] Iniciando efectos de autenticación");

    // Función interna para manejar cambios de auth
    const handleAuthChange = async (currentUser: any, source: string) => {
      if (!mounted) return;
      
      console.log(`AuthProvider: [handleAuthChange] Source: ${source} - User:`, currentUser?.id || "None");
      
      // Actualizamos el usuario inmediatamente
      setUser(currentUser);
      
      if (currentUser) {
        // EVITAR LLAMADAS DUPLICADAS: Si ya estamos buscando este perfil, no hacemos nada
        if (isFetchingProfile.current === currentUser.id) {
          console.log(`AuthProvider: [SKIP] Ya hay una búsqueda en curso para ${currentUser.id}`);
          // Aún así, si ya terminó el fetch en la otra llamada, liberamos el loading aquí también
          const alreadyHasProfile = useDataStore.getState().coachProfile?.user_id === currentUser.id;
          if (alreadyHasProfile && mounted) setLoading(false);
          return;
        }

        const cachedProfile = useDataStore.getState().coachProfile;
        if (!cachedProfile || cachedProfile.user_id !== currentUser.id) {
          try {
            isFetchingProfile.current = currentUser.id;
            console.log(`AuthProvider: [FETCH_START] Pidiendo perfil para ${currentUser.id}...`);
            const startTime = Date.now();
            
            // Promesa con timeout para evitar el cuelgue infinito de Supabase
            const fetchProfile = async () => {
              const { data: profile, error } = await supabase
                .from("coach_profiles")
                .select("*")
                .eq("user_id", currentUser.id)
                .maybeSingle();
              return { profile, error };
            };

            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Supabase Query Timeout")), 3500)
            );

            // Ganador entre el fetch real y el timeout
            const { profile, error } = await (Promise.race([fetchProfile(), timeoutPromise]) as Promise<{profile: any, error: any}>);
              
            const duration = Date.now() - startTime;
            console.log(`AuthProvider: [FETCH_END] Finalizado en ${duration}ms. Error:`, error?.message || "Ninguno");
            
            if (error) console.error("AuthProvider: [ERROR] Falló fetch de perfil:", error.message);
            
            if (mounted) {
              console.log("AuthProvider: [SUCCESS] Perfil obtenido:", profile ? "SÍ" : "NO");
              useDataStore.getState().setCoachProfile(profile as CoachProfile);
            }
          } catch (err) {
            console.error("AuthProvider: [CRITICAL] Error en catch de perfil:", err);
          } finally {
            isFetchingProfile.current = null;
          }
        } else {
          console.log("AuthProvider: [CACHE] Usando perfil de Zustand");
        }
      } else {
        console.log("AuthProvider: [CLEAR] No hay usuario, limpiando memoria.");
        useDataStore.getState().clearStore();
        isFetchingProfile.current = null;
      }
      
      if (mounted) {
        console.log("AuthProvider: [LOADING] Finalizando estado de carga.");
        setLoading(false);
      }
    };

    // Timeout de seguridad: Si en 5 segundos no hay respuesta, liberamos el loading
    const safetyTimeout = setTimeout(() => {
      if (mounted) {
        console.warn("AuthProvider: [SAFETY] Tiempo de espera agotado, liberando carga.");
        setLoading(false);
      }
    }, 5000);

    // Suscripción única a Supabase
    console.log("AuthProvider: [SUBSCRIBE] Configurando onAuthStateChange");
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("AuthProvider: [EVENT] Supabase dice:", event);
        
        // Ignoramos eventos redundantes si ya tenemos el mismo usuario y perfil
        const currentUser = session?.user;
        const storedProfile = useDataStore.getState().coachProfile;
        
        if (event === 'SIGNED_OUT') {
          setUser(null);
          useDataStore.getState().clearStore();
          setLoading(false);
          return;
        }

        // Si es un evento de sesión (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED)
        if (currentUser) {
          // Si ya tenemos el perfil de este usuario en memoria, no re-procesamos todo el flujo
          if (storedProfile?.user_id === currentUser.id) {
            console.log("AuthProvider: [EVENT_SKIP] Perfil ya sincronizado en memoria.");
            setUser(currentUser);
            setLoading(false);
            return;
          }
          
          await handleAuthChange(currentUser, `EVENT_${event}`);
        } else {
          await handleAuthChange(null, `EVENT_${event}`);
        }
      }
    );

    // Verificación inicial
    console.log("AuthProvider: [INIT] Ejecutando getSession inicial");
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("AuthProvider: [INIT] getSession completado");
      if (!mounted) return;
      
      const currentUser = session?.user;
      const storedProfile = useDataStore.getState().coachProfile;
      
      // Si el evento (INITIAL_SESSION o SIGNED_IN) ya cargó el perfil, no volvemos a llamar handleAuthChange
      if (currentUser && storedProfile?.user_id === currentUser.id) {
        console.log("AuthProvider: [INIT_SKIP] Perfil ya cargado por evento.");
        setLoading(false);
        return;
      }
      
      handleAuthChange(currentUser || null, "INITIAL_GET_SESSION");
    });

    return () => {
      console.log("AuthProvider: [UNMOUNT] Limpiando suscripción");
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []); // EFECTO DE MONTAJE ÚNICO - Sin dependencias reactivas para evitar bucles

  const signIn = async (email: string, password: string) => {
    console.log("AuthProvider: [ACTION] signIn ejecutado");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    console.log("AuthProvider: [ACTION] signOut ejecutado");
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) console.error("AuthProvider: [ERROR] SignOut:", error.message);
    setUser(null);
    clearStore();
    setLoading(false);
    window.location.href = '/';
  };

  // Memorizamos el valor del contexto para evitar re-renders innecesarios en los hijos
  const contextValue = useMemo(() => ({
    user,
    loading,
    coachProfile,
    signIn,
    signOut
  }), [user, loading, coachProfile]);

  return (
    <AuthContext.Provider value={contextValue}>
      {loading && !user ? (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-500 text-sm font-medium">Sincronizando sesión...</p>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};
