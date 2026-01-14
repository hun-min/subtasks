# Deployment Log

## 2026-01-14
- **Fix**: 타이머 정지 시 시간 누락 버그 수정
    - `App.tsx`: 플로팅 바에서 타이머 정지 시, 경과 시간을 계산하여 누적(`actTime`)하도록 로직 수정.
    - 기존에는 타이머 시작 시간(`timer_start`)만 초기화되어, 정지 시 그동안 흐른 시간이 사라지는 문제가 있었음.
- **Fix**: 플로팅 바 타이머 연동 및 시간 표시 복구
    - `App.tsx`: 하단 플로팅 바의 타이머가 실제 흐르는 시간을 반영하도록 수정 (타이머 틱 로직 추가).
    - `UnifiedTaskItem.tsx`: 할 일 우측의 시간 표시 UI가 타이머 작동 중일 때 항상 보이도록 조건 완화 및 스타일 개선.
- **Fix**: 타이머 UI 실시간 갱신 문제 해결
    - `UnifiedTaskItem.tsx`: `setInterval`을 이용한 실시간 타이머 갱신 로직 복구.
    - `task.actTime`과 `elapsedSeconds`를 합산하여 실제 흐르는 시간을 보여주도록 수정.
    - 타이머 작동 시 보라색 텍스트 및 볼드 처리로 시각적 피드백 강화.
- **Fix**: 타이머 기능 단축키 복구
    - `UnifiedTaskItem.tsx`: `Shift + Enter` 키 입력 시 타이머를 토글하는 기능 추가.
    - 기존 `Shift + Space`와 함께 사용 가능.
    - 롤백으로 인해 누락되었던 타이머 빠른 실행 기능을 복구하여 작업 효율성 증대.

## 2026-01-07
- **Fix**: 엔터 입력 시 텍스트 복제 및 잘림 버그 수정
    - `App.tsx`: `handleAddTaskAtCursor` 함수에서 React Query 캐시를 직접 수정하여 엔터 입력 즉시 UI에 반영되도록 변경.
    - 이전에는 비동기 서버 요청 결과가 오기 전까지 화면 갱신이 지연되거나, 서버 동기화 중 롤백되는 문제가 있었음.
    - 이제 엔터 입력 시 '윗줄 자르기(Update)'와 '아랫줄 생성(Add)'이 원자적으로 처리되어, 캐시에 즉시 반영되고 서버에는 백그라운드로 저장됨.
    - 이를 통해 "엔터 치면 딱 잘려서 내려가는" 빠릿하고 깔끔한 동작 구현.
- **Fix**: 모바일 헤더 레이아웃 깨짐 수정
    - `App.tsx`: 헤더 컨테이너 Flex 설정을 `flex-wrap` 방지(`flex-nowrap`)로 변경 및 `overflow-x-auto` 적용.
    - `SpaceSelector.tsx`: 모바일 `max-width`를 `140px` -> `110px`로 축소하고 말줄임표(...) 처리가 확실히 되도록 Flex 구조 개선.
    - 패딩 및 버튼 간격 미세 조정으로 좁은 화면에서도 한 줄 유지.
- **Fix**: 모바일 리스트 가독성 개선
    - `UnifiedTaskItem.tsx`: 모바일 화면에서 리스트 아이템의 좌우 패딩을 `px-6` -> `px-3`으로 줄여 텍스트 공간 확보.
    - 체크박스 등 아이콘 간격을 미세 조정하여 불필요한 공백 제거.
- **Fix**: 커서 이동 로직 2차 개선 (자동 줄바꿈 지원)
    - `UnifiedTaskItem.tsx`: `ArrowUp`/`ArrowDown` 시 `preventDefault`를 제거하여 브라우저 기본 이동 동작을 허용.
    - `setTimeout`으로 이동 후 커서 위치를 확인하여, 더 이상 이동할 수 없는 경우(맨 처음/맨 끝 유지)에만 `onFocusPrev`/`onFocusNext` 호출.
    - 이를 통해 긴 텍스트의 자동 줄바꿈(Soft Wrap) 상황에서도 커서가 엉뚱하게 튀지 않고 자연스럽게 상하 이동 가능.

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
