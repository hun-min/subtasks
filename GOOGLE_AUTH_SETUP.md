# Google OAuth 설정 방법

## Supabase Dashboard 설정

1. **Supabase Dashboard 접속**
   - https://supabase.com/dashboard
   - 프로젝트 선택

2. **Authentication > Providers**
   - Google 찾아서 활성화
   - "Enabled" 토글 ON

3. **Google Cloud Console 설정**
   - https://console.cloud.google.com
   - 프로젝트 생성 또는 선택
   - "APIs & Services" > "Credentials"
   - "Create Credentials" > "OAuth 2.0 Client ID"
   - Application type: Web application
   - Authorized redirect URIs 추가:
     ```
     https://inmgonuewvkilddynasj.supabase.co/auth/v1/callback
     ```
   - Client ID와 Client Secret 복사

4. **Supabase에 Google 정보 입력**
   - Client ID 붙여넣기
   - Client Secret 붙여넣기
   - Save

완료!
