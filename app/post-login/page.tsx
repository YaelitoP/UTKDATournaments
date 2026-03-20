'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/authContext';
import { supabase } from '@/utils/supabase/supabaseClient';

export default function PostLoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;

    const run = async () => {
      console.log("PostLogin: Checking truth in Supabase...", { userId: user?.id });
      
      if (!user) {
        console.log("PostLogin: No user, redirecting to login");
        router.replace('/');
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from('coach_profiles')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error("PostLogin: Error fetching truth from DB:", error.message);
          setErrorStatus("Error al conectar con la base de datos. Por favor, recarga la página.");
          return;
        }

        if (profile) {
          console.log("PostLogin: Profile found in DB (Truth), redirecting to /dashboard");
          router.replace('/dashboard');
        } else {
          console.log("PostLogin: No profile in DB (Truth), redirecting to registration");
          router.replace('/coach/registro');
        }
      } catch (err) {
        console.error("PostLogin: Unexpected error checking truth:", err);
        setErrorStatus("Ocurrió un error inesperado. Intenta de nuevo.");
      }
    };

    run();
  }, [user, loading, router]);

  if (!loading && !user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        {errorStatus ? (
          <>
            <p className="text-red-500 font-medium text-center px-4">{errorStatus}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-bold shadow-sm"
            >
              Recargar
            </button>
          </>
        ) : (
          <>
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-500 text-sm font-medium animate-pulse">Verificando tu perfil...</p>
          </>
        )}
      </div>
    </div>
  );
}

