-- tasks 테이블 스키마 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tasks'
ORDER BY ordinal_position;

-- targets 테이블 스키마 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'targets'
ORDER BY ordinal_position;

-- spaces 테이블 스키마 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'spaces'
ORDER BY ordinal_position;
