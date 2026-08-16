import { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { setClerkTokenGetter } from '@/lib/supabase';

export function useSupabaseAuth() {
  const { getToken } = useAuth();

  useEffect(() => {
    setClerkTokenGetter(() => getToken());
    return () => setClerkTokenGetter(null as any);
  }, [getToken]);
}
