# 쿼리도 3D

한 대의 PC/태블릿에서 2명 또는 4명이 번갈아 플레이하는 three.js 원목 보드게임 웹앱입니다.
서버 없이 동작하는 정적 사이트이며, 텍스처와 효과음은 모두 코드로 생성합니다.

**플레이**: https://rrjjyy123.github.io/Quoridor3D/

## 실행

```bash
npm install
npm run dev      # http://localhost:5182 (같은 와이파이의 태블릿에서도 PC IP:5182 로 접속 가능)
npm test         # 규칙 테스트
npm run build    # dist/ 생성
```

## 배포

`main` 브랜치에 push 하면 GitHub Actions 가 테스트 → 빌드 후 `gh-pages` 브랜치로 배포합니다.
(저장소 Settings → Pages 의 Source 가 `gh-pages` 브랜치 / `/(root)` 인지 확인)

## 규칙 요약

- 9×9 보드, 벽 20개 (2인 10개씩 / 4인 5개씩), 벽 길이 = 칸 2개
- 시작: 2인 e1·e9 / 4인 e1·a5·e9·i5, 반대편 끝줄에 먼저 도착하면 승리
- 차례마다 **말 이동**(상하좌우 1칸) 또는 **벽 설치** 중 하나, 무르기 없음
- 인접한 말은 뛰어넘기, 뒤가 막히면 대각선. 말 2개 연속 점프 불가
- 벽은 겹치거나 교차할 수 없고, 누구의 길도 완전히 막을 수 없음

## 조작

- 내 **말**을 누르면 갈 수 있는 칸이 빛남 → 빛나는 칸을 눌러 이동
- 내 앞의 **벽 보관대**를 누르면 벽 선택 → 칸 사이 홈을 눌러 설치 (태블릿은 한 번 더 탭 또는 ✓)

## 구조

| 경로 | 역할 |
| --- | --- |
| `src/game/rules.js` | 순수 규칙 로직 (이동, 점프, 벽 검사, BFS 경로) |
| `src/game/state.js` | 기록·자동 저장 |
| `src/render/*` | three.js 씬, 절차적 원목 텍스처, 말/벽, 연출, 카메라 |
| `src/ui/*` | 시작 화면, HUD, 스타일 |
| `src/audio/sfx.js` | WebAudio 합성 효과음 |
| `tests/rules.test.js` | 규칙 단위 테스트 |
