import { createContext, useContext, useEffect, useState } from 'react';
import { db, Space } from '../db';

type SpaceContextType = {
  spaces: Space[];
  currentSpace: Space | null;
  setCurrentSpace: (space: Space) => void;
  addSpace: (title: string) => Promise<void>;
  deleteSpace: (id: number) => Promise<void>;
  loading: boolean;
};

const SpaceContext = createContext<SpaceContextType | undefined>(undefined);

export function SpaceProvider({ children }: { children: React.ReactNode }) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [currentSpace, setCurrentSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSpaces();
  }, []);

  const loadSpaces = async () => {
    const allSpaces = await db.spaces.toArray();
    if (allSpaces.length === 0) {
      const id = await db.spaces.add({ title: '기본', createdAt: new Date() }) as number;
      const defaultSpace = { id, title: '기본', createdAt: new Date() };
      setSpaces([defaultSpace]);
      setCurrentSpace(defaultSpace);
    } else {
      setSpaces(allSpaces);
      const savedSpaceId = localStorage.getItem('currentSpaceId');
      const saved = savedSpaceId ? allSpaces.find(s => s.id === parseInt(savedSpaceId)) : null;
      setCurrentSpace(saved || allSpaces[0]);
    }
    setLoading(false);
  };

  const handleSetCurrentSpace = (space: Space) => {
    setCurrentSpace(space);
    localStorage.setItem('currentSpaceId', space.id!.toString());
  };

  const addSpace = async (title: string) => {
    await db.spaces.add({ title, createdAt: new Date() });
    await loadSpaces();
  };

  const deleteSpace = async (id: number) => {
    if (spaces.length <= 1) {
      alert('최소 1개의 공간이 필요합니다.');
      return;
    }
    await db.spaces.delete(id);
    await loadSpaces();
  };

  return (
    <SpaceContext.Provider value={{ spaces, currentSpace, setCurrentSpace: handleSetCurrentSpace, addSpace, deleteSpace, loading }}>
      {children}
    </SpaceContext.Provider>
  );
}

export function useSpace() {
  const context = useContext(SpaceContext);
  if (context === undefined) throw new Error('useSpace must be used within SpaceProvider');
  return context;
}
