# JEJU REF

제작 목적에 맞춰 출처가 있는 제주 디자인 레퍼런스를 검색하고 보드에 저장하는 웹 앱입니다.

운영 사이트: https://jeju-ref-studio.vercel.app (Vercel 로그인 보호)

## 기능

- Wikimedia Commons·Openverse 이미지 및 한국관광공사 TourAPI 관광·문화 검색
- 원본 출처·제작자·라이선스와 이미지 미리보기
- Neon PostgreSQL 보드 저장, 브라우저 방문자 쿠키별 분리
- 출처 기반 기획 프롬프트와 오픈소스 추론 서버 연결부
- 학습 데이터 검수: 목적·출처별 피드백 연결, 출처 누락·상충 평가 표시, 그룹 분할 후보, JSON·JSONL 내보내기
- OpenRouter 무료 모델로 텍스트 기획안 생성 연결 완료. 영상 분석·모델 학습은 미실행

## 개발

Node.js 24 이상과 pnpm을 사용합니다.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm start
```

로컬 주소는 http://127.0.0.1:4173 입니다. 로컬은 SQLite와 개발용 방문자 ID를 사용합니다. 운영 데이터와 별개이며 외부 API 키·추론 서버는 Vercel에서 설정합니다.

## Vercel 배포

1. 이 저장소를 Vercel 프로젝트에 연결합니다.
2. 서버 환경변수 SESSION_SECRET, DATABASE_URL, TOURAPI_SERVICE_KEY를 등록합니다.
3. Neon 스키마는 환경변수가 있는 로컬에서 `node --env-file=.env.local scripts/migrate-neon.mjs`로 준비합니다.
4. `pnpm build`가 정적 파일을 생성하며 api/가 서버 함수를 제공합니다.

현재 OpenRouter 무료 연결은 INFERENCE_BASE_URL=https://openrouter.ai/api/v1, INFERENCE_MODEL=openrouter/free 및 서버 Secret인 INFERENCE_API_KEY를 사용합니다. 실제 비밀 값은 Git에 커밋하지 않습니다. [.env.example](.env.example)은 변수 이름만 제공합니다.

[상세 구성·API·추론 서버 연결 안내](README_VERCEL.md)

## 권한과 저장

표시 라이선스가 모델 학습 허가를 의미하지 않습니다. 자료별 원본 이용조건을 확인해야 합니다. 저장은 브라우저 세션별이며 다중 기기 계정 동기화가 아닙니다. 중요한 보드는 JSON으로 내보내 보관하세요.

## 라이선스

앱 소스는 MIT입니다. 외부 이미지·서체·관광 자료는 각각의 원본 라이선스를 따릅니다.
