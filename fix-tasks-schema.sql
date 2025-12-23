-- tasks 테이블에 누락된 컬럼 추가
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "targetId" bigint;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "isCompleted" boolean DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "completedAt" timestamp with time zone;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "timerCount" integer;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "hideFromAutocomplete" boolean DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "auditNote" text;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_tasks_targetId ON tasks("targetId");
CREATE INDEX IF NOT EXISTS idx_tasks_isCompleted ON tasks("isCompleted");
CREATE INDEX IF NOT EXISTS idx_tasks_createdAt ON tasks("createdAt");
