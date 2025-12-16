-- Supabase Dashboard > SQL Editor에서 실행하세요

-- 1. spaces 테이블 생성
CREATE TABLE IF NOT EXISTS spaces (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_spaces_user_id ON spaces(user_id);

-- 3. RLS 활성화
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책
CREATE POLICY "Users can view own spaces" ON spaces
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own spaces" ON spaces
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own spaces" ON spaces
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own spaces" ON spaces
  FOR DELETE USING (auth.uid() = user_id);
