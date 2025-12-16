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
  
  // 로딩? 그런 거 모릅니다. 무조건 보여줍니다.
  const loading = false;

  // [절대 방어선 1] 초기값 설정 시, 캐시가 비어있으면 무조건 '임시 공간'이라도 박아넣습니다.
  const [spaces, setSpaces] = useState<Space[]>(() => {
    try {
      const cached = localStorage.getItem('ultra_spaces_cache');
      const parsed = cached ? JSON.parse(cached) : [];
      if (parsed.length > 0) return parsed;
    } catch {}
    // 캐시조차 없으면 이거라도 리턴. 빈 배열([]) 절대 금지.
    return [{ id: -1, title: '기본 공간', createdAt: new Date() }];
  });

  // [절대 방어선 2] 현재 선택된 공간이 없으면 목록의 첫 번째 강제 선택
  const [currentSpace, setCurrentSpace] = useState<Space | null>(() => {
    try {
      const savedId = localStorage.getItem('currentSpaceId');
      const found = savedId ? spaces.find(s => s.id === parseInt(savedId)) : null;
      return found || spaces[0];
    } catch {
      return spaces[0];
    }
  });

  useEffect(() => {
    const syncSpaces = async () => {
      let finalSpaces: Space[] = [];

      try {
        if (user) {
          // Supabase 조회
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
            // 서버에 없으면 생성 시도
            const { data: newSpace } = await supabase
              .from('spaces')
              .insert({ user_id: user.id, title: '기본 공간' })
              .select()
              .single();
            
            if (newSpace) {
              finalSpaces = [{ id: newSpace.id, title: newSpace.title || newSpace.name, createdAt: new Date(newSpace.created_at) }];
            }
          }
        } else {
          // 로컬 DB 조회
          try { finalSpaces = await db.spaces.toArray(); } catch {}
          if (finalSpaces.length === 0) {
             const id = await db.spaces.add({ title: '기본 공간', createdAt: new Date() }) as number;
             finalSpaces = [{ id, title: '기본 공간', createdAt: new Date() }];
          }
        }
      } catch (e) {
        console.warn("Sync Error:", e);
      }

      // [절대 방어선 3] 서버/DB 통신 결과가 빈 배열([])이면, 기존 화면을 유지하거나 강제로 만듦
      // 절대 빈 배열로 업데이트하지 않음.
      if (finalSpaces.length === 0) {
        // 통신 실패 등으로 데이터가 없으면, 기존에 떠있는거라도 유지 (state 변경 안 함)
        // 만약 기존 state도 비어있다면(그럴리 없지만), 강제 주입
        if (spaces.length === 0) {
            const fallback = [{ id: -1, title: '기본 공간 (오프라인)', createdAt: new Date() }];
            setSpaces(fallback);
            setCurrentSpace(fallback[0]);
        }
        return; // 빈 데이터로 덮어쓰기 방지하고 종료
      }

      // 데이터가 존재할 때만 업데이트
      setSpaces(finalSpaces);
      localStorage.setItem('ultra_spaces_cache', JSON.stringify(finalSpaces));
      
      setCurrentSpace(prev => {
        if (!prev) return finalSpaces[0];
        const match = finalSpaces.find(s => s.id === prev.id);
        const next = match || finalSpaces[0];
        if (next.id) localStorage.setItem('currentSpaceId', next.id.toString());
        return next;
      });
    };

    // user.id가 바뀔 때만 실행
    syncSpaces();
    
  }, [user?.id]);

  // --- 상태 변경 함수들 ---

  const handleSetCurrentSpace = (space: Space) => {
    setCurrentSpace(space);
    if (space.id) localStorage.setItem('currentSpaceId', space.id.toString());
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
          const realSpace = { id: data.id, title: data.title || data.name, createdAt: new Date(data.created_at) };
          // 임시 ID를 진짜 ID로 교체
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
    } catch (e) { console.warn("저장 실패"); }
  };

  const updateSpace = async (id: number, title: string) => {
    const nextSpaces = spaces.map(s => s.id === id ? { ...s, title } : s);
    updateCache(nextSpaces);
    if (currentSpace?.id === id) setCurrentSpace(prev => prev ? { ...prev, title } : null);

    try {
      if (user) await supabase.from('spaces').update({ title }).eq('id', id).eq('user_id', user.id);
      else await db.spaces.update(id, { title });
    } catch (e) { console.warn("수정 실패"); }
  };

  const deleteSpace = async (id: number) => {
    // [절대 방어선 4] 1개 남았으면 삭제 금지. 버튼 눌러도 반응 안 함.
    if (spaces.length <= 1) { 
        alert('최소 1개의 공간이 필요합니다.'); 
        return; 
    }
    
    const nextSpaces = spaces.filter(s => s.id !== id);
    updateCache(nextSpaces);
    
    if (currentSpace?.id === id) {
      const next = nextSpaces[0];
      setCurrentSpace(next);
      if (next.id) localStorage.setItem('currentSpaceId', next.id.toString());
    }

    try {
      if (user) await supabase.from('spaces').delete().eq('id', id).eq('user_id', user.id);
      else await db.spaces.delete(id);
    } catch (e) { console.warn("삭제 실패"); }
  };

  // 안전장치: 렌더링 시점에 null이면 강제 할당
  const safeCurrentSpace = currentSpace || spaces[0] || { id: -1, title: '기본 공간', createdAt: new Date() };

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
