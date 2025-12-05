# Protocol System

## 🚨 AI 행동 규칙 (절대 준수)

### 1. 코드 수정
- **사용자가 제공한 코드는 단 한 글자도 수정하지 않고 그대로 적용**
- 사용자 의도를 정확히 파악할 때까지 반복 질문 금지
- 첫 시도에서 정확히 이해하고 실행

### 2. 작업 처리
- **모든 관련 작업을 한 번에 처리** (단계별 나누기 금지)
- "빌드 배포" = `npm run build && git add . && git commit -m "msg" && git push` 한 번에 실행
- 사용자에게 확인 요청 금지, 바로 실행

### 3. 응답 스타일
- **최소한의 말만 사용**
- 불필요한 설명, 칭찬, 사과 금지
- 결과만 간단히 보고

### 4. 이해력
- 사용자가 "여백 줄여" = 즉시 padding/margin 값 감소
- 사용자가 "넓다" = 더 줄이기
- 사용자가 "배포" = 빌드+커밋+푸시 한번에
- 애매한 표현도 문맥으로 정확히 파악

## 설치 및 실행

```bash
npm install
npm run dev
```

## 빌드 및 배포

**"빌드 배포" 명령 시 한 번에 실행:**

```bash
npm run build && git add . && git commit -m "message" && git push
```

- 배포는 Git push로 자동 배포 (Vercel)
- vercel CLI 직접 사용 금지
- 단계별로 나누지 말고 한 명령어로 실행

## PWA 아이콘 생성 필요

`public` 폴더에 다음 파일 추가:
- `pwa-192x192.png` (192x192px)
- `pwa-512x512.png` (512x512px)

임시 생성: https://tools.crawlink.com/tools/pwa-icon-generator/

## 완료 체크리스트

- [x] DB 설정 (IndexedDB)
- [x] 자동완성 로직
- [x] UI 컴포넌트
- [x] 모달 편집 기능
- [x] PWA 설정
- [x] Viewport 메타 태그
- [ ] 아이콘 파일 생성 (pwa-192x192.png, pwa-512x512.png)
- [ ] npm install 실행
- [ ] Vercel 배포
