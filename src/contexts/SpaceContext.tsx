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
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [currentSpace, setCurrentSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSpaces();
  }, [user]);

  const loadSpaces = async () => {
    let allSpaces: Space[] = [];
    
    if (user) {
      // 로그인 시 Supabase에서 로드
      const { data } = await supabase.from('spaces').select('*').eq('user_id', user.id);
      if (data && data.length > 0) {
        allSpaces = data.map(s => ({ id: s.id, title: s.title, createdAt: new Date(s.created_at) }));
        // IndexedDB에도 동기화
        await db.spaces.clear();
        await db.spaces.bulkAdd(allSpaces);
      } else {
        // Supabase에 없으면 기본 생성
        const { data: newSpace } = await supabase.from('spaces').insert({ user_id: user.id, title: '기본' }).select().single();
        if (newSpace) {
          const defaultSpace = { id: newSpace.id, title: newSpace.title, createdAt: new Date(newSpace.created_at) };
          allSpaces = [defaultSpace];
          await db.spaces.add(defaultSpace);
        }
      }
    } else {
      // 비로그인 시 IndexedDB에서 로드
      allSpaces = await db.spaces.toArray();
      if (allSpaces.length === 0) {
        const id = await db.spaces.add({ title: '기본', createdAt: new Date() }) as number;
        const defaultSpace = { id, title: '기본', createdAt: new Date() };
        allSpaces = [defaultSpace];
      }
    }
    
    setSpaces(allSpaces);
    const savedSpaceId = localStorage.getItem('currentSpaceId');
    const saved = savedSpaceId ? allSpaces.find(s => s.id === parseInt(savedSpaceId)) : null;
    setCurrentSpace(saved || allSpaces[0]);
    setLoading(false);
  };

  const handleSetCurrentSpace = (space: Space) => {
    setCurrentSpace(space);
    localStorage.setItem('currentSpaceId', space.id!.toString());
  };

  const addSpace = async (title: string) => {
    if (user) {
      await supabase.from('spaces').insert({ user_id: user.id, title });
    } else {
      await db.spaces.add({ title, createdAt: new Date() });
    }
    await loadSpaces();
  };

  const updateSpace = async (id: number, title: string) => {
    if (user) {
      await supabase.from('spaces').update({ title }).eq('id', id).eq('user_id', user.id);
    } else {
      await db.spaces.update(id, { title });
    }
    await loadSpaces();
  };

  const deleteSpace = async (id: number) => {
    if (spaces.length <= 1) {
      alert('최소 1개의 공간이 필요합니다.');
      return;
    }
    if (user) {
      await supabase.from('spaces').delete().eq('id', id).eq('user_id', user.id);
    } else {
      await db.spaces.delete(id);
    }
    await loadSpaces();
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
