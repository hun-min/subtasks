# Protocol System

## 설치 및 실행

```bash
npm install
npm run dev
```

## 배포

```bash
npm run build
vercel --prod
```

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
