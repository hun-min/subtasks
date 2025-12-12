-- 기존 task_logs 테이블에 user_id와 space_id 컬럼 추가
-- Supabase Dashboard > SQL Editor에서 실행하세요

-- 1. user_id 컬럼 추가 (nullable로 시작)
ALTER TABLE task_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. space_id 컬럼 추가
ALTER TABLE task_logs ADD COLUMN IF NOT EXISTS space_id INTEGER DEFAULT 1;

-- 3. 기존 Primary Key 변경 (date만 -> date + user_id + space_id)
ALTER TABLE task_logs DROP CONSTRAINT IF EXISTS task_logs_pkey;
ALTER TABLE task_logs ADD PRIMARY KEY (date, user_id, space_id);

-- 4. 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_task_logs_user_space ON task_logs(user_id, space_id);

-- 5. RLS (Row Level Security) 활성화
ALTER TABLE task_logs ENABLE ROW LEVEL SECURITY;

-- 6. RLS 정책: 사용자는 자신의 데이터만 조회/수정 가능
CREATE POLICY "Users can view own logs" ON task_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs" ON task_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own logs" ON task_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own logs" ON task_logs
  FOR DELETE USING (auth.uid() = user_id);
