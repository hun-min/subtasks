# Protocol System

## 🚨 최우선 규칙
**사용자가 제공한 코드는 단 한 글자도 수정하지 않고 그대로 적용한다.**

## 설치 및 실행

```bash
npm install
npm run dev
```

## 빌드 및 배포

**"빌드 배포" 명령 시 반드시 순서대로 실행:**

```bash
# 1. 로컬 빌드 테스트 (필수)
npm run build

# 2. Git 배포 (Vercel 자동 배포)
git add .
git commit -m "message"
git push
```

배포는 Git push로 자동 배포됩니다. vercel 직접 사용 금지.

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
