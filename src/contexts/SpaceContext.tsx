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
      return cached ? JSON.parse(cached) : [{ id: 1, title: '기본 공간', createdAt: new Date() }];
    } catch {
      return [{ id: 1, title: '기본 공간', createdAt: new Date() }];
    }
  });

  const [currentSpace, setCurrentSpace] = useState<Space | null>(() => {
    try {
      const cached = localStorage.getItem('ultra_spaces_cache');
      const savedId = localStorage.getItem('currentSpaceId');
      const parsedSpaces = cached ? JSON.parse(cached) : [{ id: 1, title: '기본 공간', createdAt: new Date() }];
      const found = savedId ? parsedSpaces.find((s: Space) => s.id === parseInt(savedId)) : null;
      return found || parsedSpaces[0];
    } catch {
      return { id: 1, title: '기본 공간', createdAt: new Date() };
    }
  });

  useEffect(() => {
    const syncSpaces = async () => {
      let finalSpaces: Space[] = [];

      try {
        if (user) {
          const { data } = await supabase
            .from('spaces')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true });

          if (data && data.length > 0) {
            finalSpaces = data.map(s => ({ 
              id: s.id, 
              title: s.title || s.name, 
              createdAt: new Date(s.created_at) 
            }));
          } else {
            const { data: newSpace, error: createError } = await supabase
              .from('spaces')
              .insert({ user_id: user.id, title: '기본 공간' })
              .select()
              .single();
            
            if (newSpace) {
              finalSpaces = [{ 
                id: newSpace.id, 
                title: newSpace.title || newSpace.name, 
                createdAt: new Date(newSpace.created_at) 
              }];
            } else {
              console.warn("공간 생성 실패, 임시 공간 사용:", createError);
              finalSpaces = [{ id: -1, title: '오프라인 공간', createdAt: new Date() }];
            }
          }
        } else {
          try {
            finalSpaces = await db.spaces.toArray();
            if (finalSpaces.length === 0) {
               const id = await db.spaces.add({ title: '기본 공간', createdAt: new Date() }) as number;
               finalSpaces = [{ id, title: '기본 공간', createdAt: new Date() }];
            }
          } catch {
             finalSpaces = [{ id: 1, title: '기본 공간', createdAt: new Date() }];
          }
        }

        setSpaces(finalSpaces);
        localStorage.setItem('ultra_spaces_cache', JSON.stringify(finalSpaces));
        
        setCurrentSpace(prev => {
          if (!prev) return finalSpaces[0];
          const match = finalSpaces.find(s => s.id === prev.id);
          const next = match || finalSpaces[0];
          
          if (next.id) localStorage.setItem('currentSpaceId', next.id.toString());
          return next;
        });

      } catch (e) {
        console.warn("Sync Error:", e);
      }
    };

    syncSpaces();
    
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

  const safeCurrentSpace = currentSpace || spaces[0] || { id: -1, title: '로딩 중...', createdAt: new Date() };

  return (
    <SpaceContext.Provider value={{ spaces, currentSpace: safeCurrentSpace, setCurrentSpace: handleSetCurrentSpace, addSpace, updateSpace, deleteSpace, loading }}>
      {children}
    </SpaceContext.Provider>
  );
}

export function useSpace() {
  const context = useContext(SpaceContext);
  if (context === undefined) throw new Error('useSpace must be used within SpaceProvider');
  return context;
}
