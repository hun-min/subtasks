# 별(Star) 기능 추가 및 UI 개선 계획

## 1. DB 스키마 및 타입 변경
- **목표**: 태스크에 중요도(별) 표시를 위한 데이터 구조 추가
- **작업**:
  - `add-starred-column.sql` 파일 생성:
    ```sql
    ALTER TABLE task_logs ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT false;
    ```
  - `src/types.ts` 파일 수정:
    - `Task` 인터페이스에 `is_starred?: boolean;` 속성 추가

## 2. SpaceSelector UI 개선
- **목표**: 스페이스 이름이 길어질 경우 줄바꿈 없이 말줄임표(...)로 표시
- **작업**:
  - `src/components/SpaceSelector.tsx` 수정
  - 스페이스 이름을 감싸는 `span` 태그에 다음 클래스 추가:
    - `whitespace-nowrap`: 줄바꿈 방지
    - `overflow-hidden`: 넘치는 텍스트 숨김
    - `text-ellipsis`: 말줄임표 표시
    - `max-w-[100px]` (또는 적절한 너비): 최대 너비 제한

## 3. UnifiedTaskItem UI 개선
- **목표**: 체크박스와 태스크 텍스트의 수직 정렬 맞춤
- **작업**:
  - `src/components/UnifiedTaskItem.tsx` 수정
  - 체크박스를 감싸는 `div`의 클래스 조정:
    - 기존 `pt-2`를 `mt-[3px]` 또는 적절한 마진으로 변경하여 텍스트 첫 줄과 높이를 맞춤
