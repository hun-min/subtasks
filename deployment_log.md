# Deployment Log

## 2026-01-06
- **Fix**: 커서 이동 로직 수정
    - `textarea` 내부 줄 바꿈 이동 시 브라우저 기본 동작(`preventDefault` 미호출)을 따르도록 변경하여 커서의 세로 위치(같은 X축 좌표) 유지.
    - 첫 번째 줄에서 위로 이동 시에만 `onFocusPrev` 호출.
    - 마지막 줄에서 아래로 이동 시에만 `onFocusNext` 호출.
    - 이를 통해 텍스트 편집기와 동일한 자연스러운 커서 이동 경험 제공.
- **Fix**: allow saving empty tasks list (deletion)
    - `saveToSupabase`에서 `isLoading`일 때만 저장을 막고, 그 외에는 빈 배열도 정상적으로 저장되도록 수정.
    - `handleDeleteTask`에서 삭제 후 즉시 `saveToSupabase`를 호출하여 서버와 동기화.
    - 이를 통해 할 일을 모두 삭제해도 다시 살아나는 "좀비 데이터" 문제 해결.
- **Fix**: 데이터 저장 차단 문제 긴급 해결
    - `saveToSupabase` 및 `saveToSupabaseAtDate` 함수 내 `isLoading` 체크 로직 제거.
    - 데이터 로딩 중에도 사용자 입력이 무시되지 않고 저장되도록 수정.
    - 캘린더 등 UI에서 `isLoading` 시 `pointer-events-none` 스타일 제거하여 조작 불가능 상태 방지.
