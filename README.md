# ✅ 나의 체크리스트

날짜별로 할 일을 관리하고, 로그인하면 어느 기기에서든 같은 목록을 볼 수 있는 체크리스트 웹앱입니다.

**🔗 사이트 바로가기: https://checklist-app-omega-eight.vercel.app**

## 주요 기능

- **날짜별 할 일**: ◀ ▶ 버튼이나 달력으로 날짜를 골라 그날의 할 일을 관리
- **날짜별 전체 보기**: 모든 할 일을 날짜별로 묶어 최신순으로 표시, 날짜마다 완료 개수 표시
- **진행률 표시**: 완료한 비율을 막대와 퍼센트로 표시
- **추가 · 수정 · 삭제**: 더블클릭으로 수정, ✕ 버튼으로 삭제, 완료 항목 일괄 삭제
- **히스토리 보존**: 삭제해도 데이터가 지워지지 않고, 모든 변경 이력이 `checklist_history` 테이블에 남음
- **✨ AI 기능 (OpenRouter)** — 오른쪽 위 ⚙️ 설정에서 OpenRouter API 키와 모델을 입력해 사용
  - **문장으로 추가**: "내일 3시 치과, 금요일까지 보고서"처럼 쓰고 ✨ AI 를 누르면 날짜별 할 일로 나눠 미리보기 후 추가
  - **쪼개기**: 항목 옆 ✨ 를 누르면 세부 단계 3~7개로 나눠 제안
  - **AI 정리**: 보고 있는 날짜(또는 전체)의 진행 평가 · 우선순위 · 다음 행동 제안
  - API 키는 이 브라우저(localStorage)에만 저장되고 openrouter.ai 로만 전송됩니다 (DB · 서버에 저장하지 않음)
- **필터**: 전체 / 진행 중 / 완료
- **텍스트로 복사**: 날짜별로 정리된 `[x] 할 일` 형식으로 클립보드에 복사
- **클라우드 저장**: 이메일 로그인 후 Supabase에 저장 — PC·휴대폰에서 같은 목록 사용
- **다크 모드**: 시스템 설정에 맞춰 자동 전환

## 사용 기술

| 구분 | 내용 |
|---|---|
| 화면 | HTML · CSS · JavaScript (빌드 도구 없음, 파일 하나) |
| 데이터 · 로그인 | [Supabase](https://supabase.com) (PostgreSQL + Auth, 행 단위 보안 RLS) |
| 배포 | [Vercel](https://vercel.com) |

## 파일 구성

| 파일 | 설명 |
|---|---|
| `index.html` | 체크리스트 앱 전체 |
| `config.js` | Supabase 주소와 공개(publishable) 키 |
| `supabase.sql` | 할 일 테이블과 보안 규칙을 만드는 SQL |
| `supabase/config.toml` | Supabase 로그인 설정 (사이트 주소, 이메일 인증) |
| `배포안내.md` | Supabase 연결 · Vercel 배포 단계별 안내 |
| `mcp/` | Claude에서 할 일을 다루는 MCP 서버 |
| `.mcp.json` | Claude Code용 MCP 서버 등록 설정 |

## 🤖 Claude에서 쓰기 (MCP)

`mcp/` 폴더의 MCP 서버를 연결하면 Claude에게 말로 체크리스트를 관리할 수 있습니다.

> "오늘 할 일 보여줘" · "내일 할 일에 '보고서 제출' 추가해줘" · "이번 주 진행률 요약해줘"

설치와 연결 방법은 [mcp/README.md](mcp/README.md)를 참고하세요.

## 보안

- 로그인한 사용자는 **자기 할 일만** 보고 고칠 수 있습니다 (Supabase RLS 정책).
- `config.js`의 키는 브라우저에 공개되어도 되는 **publishable 키**입니다.
  비밀 키(`sb_secret_…`, `service_role`)는 저장소에 넣지 마세요.

## 직접 실행하기

1. 이 저장소를 내려받습니다.
2. Supabase 프로젝트를 만들고 SQL Editor에서 `supabase.sql`을 실행합니다.
3. `config.js`에 내 프로젝트의 URL과 publishable 키를 넣습니다.
4. 로컬에서 확인합니다.

   ```bash
   npx serve .
   ```

5. Vercel에 배포합니다.

   ```bash
   npx vercel --prod
   ```

자세한 내용은 [배포안내.md](배포안내.md)를 참고하세요.
