'use client'
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CompetidoresRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return <div className="p-6 text-center text-gray-500 italic">Redirigiendo al panel...</div>;
}
