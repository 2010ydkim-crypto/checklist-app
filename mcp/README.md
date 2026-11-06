# 체크리스트 MCP 서버

Claude(Claude Code, Claude Desktop 등)에서 [체크리스트 사이트](https://checklist-app-omega-eight.vercel.app)의
할 일을 말로 조회·추가·수정·삭제할 수 있게 해 주는 MCP 서버입니다.

> 예) "오늘 할 일 보여줘", "내일 할 일에 '보고서 제출' 추가해줘", "이번 주 진행률 요약해줘"

## 제공 도구

| 도구 | 하는 일 |
|---|---|
| `list_items` | 할 일 조회 — 특정 날짜(기본: 오늘), 기간(from~to), 전체, 진행 중/완료/삭제됨 필터 |
| `add_items` | 할 일 여러 개를 한 번에 추가 (기본: 오늘) |
| `update_item` | 완료 체크, 내용 수정, 다른 날짜로 옮기기 |
| `delete_items` | 할 일 삭제 (실제로 지우지 않고 삭제 표시 → 복구 가능) |
| `restore_items` | 삭제한 할 일 복구 |
| `history` | 추가·수정·완료·삭제·복구 변경 이력 조회 |
| `summary` | 기간별 진행률 요약 (기본: 최근 7일) |

로그인한 계정 **본인의 할 일만** 다룹니다 (Supabase RLS 보안 규칙).

## 빠른 설치 (저장소 내려받기 없이, 공유용)

필요한 것: [Node.js](https://nodejs.org) 18 이상, [체크리스트 사이트](https://checklist-app-omega-eight.vercel.app) 계정

**Claude Code** — 한 줄로 등록 (이메일·비밀번호는 본인 것으로)

```bash
claude mcp add checklist --scope user -e CHECKLIST_EMAIL=내이메일@example.com -e CHECKLIST_PASSWORD=내비밀번호 -- npx -y github:2010ydkim-crypto/checklist-app
```

**Claude Desktop** — 설정 → 개발자 → 설정 편집 → `claude_desktop_config.json`

```json
{
  "mcpServers": {
    "checklist": {
      "command": "npx",
      "args": ["-y", "github:2010ydkim-crypto/checklist-app"],
      "env": {
        "CHECKLIST_EMAIL": "내이메일@example.com",
        "CHECKLIST_PASSWORD": "내비밀번호"
      }
    }
  }
}
```

Windows에서 `npx`를 찾지 못하면 `"command": "cmd"`, `"args": ["/c", "npx", "-y", "github:2010ydkim-crypto/checklist-app"]` 로 바꾸세요.
설정 저장 후 Claude 앱을 **완전히 종료했다가 다시 실행**하면 연결됩니다. 첫 실행은 내려받기 때문에 10~30초 걸릴 수 있습니다.

> 비밀번호가 설정 파일에 그대로 저장됩니다. 공유하는 화면·파일에 설정 내용이 노출되지 않게 주의하세요.

## 직접 설치 (저장소를 내려받아 개발할 때)

1. [체크리스트 사이트](https://checklist-app-omega-eight.vercel.app)에서 회원가입합니다.
2. 패키지를 설치합니다.

   ```bash
   cd mcp
   npm install
   ```

3. 계정 정보를 **Windows 사용자 환경 변수**로 등록합니다. (PowerShell, 본인 정보로 바꿔서)

   ```powershell
   [Environment]::SetEnvironmentVariable('CHECKLIST_EMAIL', '내이메일@example.com', 'User')
   [Environment]::SetEnvironmentVariable('CHECKLIST_PASSWORD', '내비밀번호', 'User')
   ```

   등록 후 Claude 앱(또는 터미널)을 **완전히 껐다 켜야** 적용됩니다.
   비밀번호는 파일에 적지 말고 환경 변수로만 두세요.

## Claude Code에 연결

### 방법 A — 이 저장소 폴더에서 Claude Code 사용

저장소 루트의 `.mcp.json`에 이미 등록되어 있습니다.
`checklist-app` 폴더를 열고 Claude Code를 시작하면 `checklist` 서버 사용 여부를 묻습니다 → 허용.

### 방법 B — 어느 폴더에서든 사용

```bash
claude mcp add checklist --scope user -- node "D:\김영달\20261105_클로드교육\checklist-app\mcp\index.js"
```

(환경 변수 `CHECKLIST_EMAIL`, `CHECKLIST_PASSWORD`는 위 3단계에서 등록한 값을 그대로 씁니다.)

### Claude Desktop (채팅 앱)

설정 → 개발자 → 설정 편집에서 `claude_desktop_config.json`에 추가:

```json
{
  "mcpServers": {
    "checklist": {
      "command": "node",
      "args": ["D:\\김영달\\20261105_클로드교육\\checklist-app\\mcp\\index.js"]
    }
  }
}
```

## 연결 확인

Claude에게 "체크리스트 오늘 할 일 보여줘"라고 물어보세요.
`CHECKLIST_EMAIL ... 설정되지 않았습니다` 오류가 나오면 환경 변수 등록 후 앱을 다시 시작했는지 확인하세요.
