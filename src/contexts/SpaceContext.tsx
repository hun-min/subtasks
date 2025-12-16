import { createContext, useContext, useEffect, useState } from 'react';
import { db, Space } from '../db';
import { supabase } from '../supabase';
import { useAuth } from './AuthContext';

type SpaceContextType = {
  spaces: Space[];
  currentSpace: Space | null;
  setCurrentSpace: (space: Space) => void;
  addSpace: (title: string) => Promise<void>;
  updateSpace: (id: number, title: string) => Promise<void>;
  deleteSpace: (id: number) => Promise<void>;
  loading: boolean;
};

const SpaceContext = createContext<SpaceContextType | undefined>(undefined);

export function SpaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [loading] = useState(false);

  const [spaces, setSpaces] = useState<Space[]>(() => {
    try {
      const cached = localStorage.getItem('ultra_spaces_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [currentSpace, setCurrentSpace] = useState<Space | null>(() => {
    try {
      const cachedSpaces = localStorage.getItem('ultra_spaces_cache');
      const savedId = localStorage.getItem('currentSpaceId');
      if (cachedSpaces && savedId) {
        const parsed = JSON.parse(cachedSpaces);
        return parsed.find((s: Space) => s.id === parseInt(savedId)) || parsed[0] || null;
      }
      return null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let isMounted = true;

    const loadSpaces = async () => {
      let allSpaces: Space[] = [];

      try {
        if (user) {
          const { data } = await supabase.from('spaces').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
          if (data && data.length > 0) {
            allSpaces = data.map(s => ({ id: s.id, title: s.title, createdAt: new Date(s.created_at) }));
          } else {
            const { data: newSpace } = await supabase.from('spaces').insert({ user_id: user.id, title: '기본' }).select().single();
            if (newSpace) {
              allSpaces = [{ id: newSpace.id, title: newSpace.title, createdAt: new Date(newSpace.created_at) }];
            }
          }
        } else {
          try {
            allSpaces = await db.spaces.toArray();
            if (allSpaces.length === 0) {
              const id = await db.spaces.add({ title: '기본', createdAt: new Date() }) as number;
              allSpaces = [{ id, title: '기본', createdAt: new Date() }];
            }
          } catch (e) {
            if (spaces.length === 0) allSpaces = [{ id: 9999, title: '내 공간', createdAt: new Date() }];
            else allSpaces = spaces;
          }
        }

        if (isMounted) {
          setSpaces(allSpaces);
          localStorage.setItem('ultra_spaces_cache', JSON.stringify(allSpaces));
          
          const savedSpaceId = localStorage.getItem('currentSpaceId');
          const saved = savedSpaceId ? allSpaces.find(s => s.id === parseInt(savedSpaceId)) : null;
          const nextSpace = saved || allSpaces[0];
          
          setCurrentSpace(nextSpace);
          if (nextSpace?.id) localStorage.setItem('currentSpaceId', nextSpace.id.toString());
        }
      } catch (error) {
        console.error('Error loading spaces:', error);
      }
    };

    loadSpaces();
    return () => { isMounted = false; };
  }, [user?.id]);

  const handleSetCurrentSpace = (space: Space) => {
    setCurrentSpace(space);
    localStorage.setItem('currentSpaceId', space.id!.toString());
  };

  const updateCache = (newSpaces: Space[]) => {
    setSpaces(newSpaces);
    localStorage.setItem('ultra_spaces_cache', JSON.stringify(newSpaces));
  };

  const addSpace = async (title: string) => {
    const tempId = Date.now();
    const tempSpace = { id: tempId, title, createdAt: new Date() };
    const nextSpaces = [...spaces, tempSpace];
    
    updateCache(nextSpaces);
    setCurrentSpace(tempSpace);

    try {
      if (user) {
        const { data } = await supabase.from('spaces').insert({ user_id: user.id, title }).select().single();
        if (data) {
          const realSpace = { id: data.id, title: data.title, createdAt: new Date(data.created_at) };
          const fixedSpaces = nextSpaces.map(s => s.id === tempId ? realSpace : s);
          updateCache(fixedSpaces);
          setCurrentSpace(realSpace);
          localStorage.setItem('currentSpaceId', realSpace.id.toString());
        }
      } else {
        const id = await db.spaces.add({ title, createdAt: new Date() }) as number;
        const realSpace = { id, title, createdAt: new Date() };
        const fixedSpaces = nextSpaces.map(s => s.id === tempId ? realSpace : s);
        updateCache(fixedSpaces);
        setCurrentSpace(realSpace);
        localStorage.setItem('currentSpaceId', id.toString());
      }
    } catch (e) {
      console.warn('Save failed');
    }
  };

  const updateSpace = async (id: number, title: string) => {
    const nextSpaces = spaces.map(s => s.id === id ? { ...s, title } : s);
    updateCache(nextSpaces);
    if (currentSpace?.id === id) setCurrentSpace(prev => prev ? { ...prev, title } : null);

    try {
      if (user) await supabase.from('spaces').update({ title }).eq('id', id).eq('user_id', user.id);
      else await db.spaces.update(id, { title });
    } catch (e) { console.warn('Update failed'); }
  };

  const deleteSpace = async (id: number) => {
    if (spaces.length <= 1) { alert('최소 1개의 공간이 필요합니다.'); return; }
    
    const nextSpaces = spaces.filter(s => s.id !== id);
    updateCache(nextSpaces);
    
    if (currentSpace?.id === id) {
      const nextSpace = nextSpaces[0];
      setCurrentSpace(nextSpace);
      if (nextSpace.id) localStorage.setItem('currentSpaceId', nextSpace.id.toString());
    }

    try {
      if (user) await supabase.from('spaces').delete().eq('id', id).eq('user_id', user.id);
      else await db.spaces.delete(id);
    } catch (e) { console.warn('Delete failed'); }
  };

  return (
    <SpaceContext.Provider value={{ spaces, currentSpace, setCurrentSpace: handleSetCurrentSpace, addSpace, updateSpace, deleteSpace, loading }}>
      {children}
    </SpaceContext.Provider>
  );
}

export function useSpace() {
  const context = useContext(SpaceContext);
  if (context === undefined) throw new Error('useSpace must be used within SpaceProvider');
  return context;
}
