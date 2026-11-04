# JEJU REF · Vercel 0.3

## 배포 구성

- Vercel 프로젝트: woolly1 / jeju-ref-studio
- 프런트엔드: public → build-vercel.mjs → vercel-public
- 서버: api/[...path].js / Node.js
- 저장소: Neon 무료 플랜 PostgreSQL, server/neon-store.js
- 공개 이미지: Wikimedia Commons, Openverse
- 제주 관광·문화: 한국관광공사 TourAPI, 승인된 개발계정 키 연결 완료

운영 주소는 https://jeju-ref-studio.vercel.app 이며 Production 배포를 검증했다. Vercel Authentication 배포 보호가 적용되어 있다. 기존 Sites의 URL과 저장 데이터는 별도로 유지되며 자동 이관되지 않는다. Vercel 앱은 서명된 HttpOnly 방문자 쿠키로 보드를 분리한다. Vercel 로그인은 배포 보호이며 앱의 다중 기기 사용자 계정과는 다르다. 쿠키 삭제·다른 브라우저·다른 배포 호스트에서는 새로운 보드로 시작한다. 중요한 보드는 JSON으로 내보내 보관한다.

## 서버 환경변수

| 이름 | 용도 | 필수 |
|---|---|---|
| SESSION_SECRET | 방문자 세션 서명, 최소 32자 | 필수, Preview·Production 별도 값 |
| DATABASE_URL | Neon 서버리스 연결 | 서버 저장 시 필수 |
| TOURAPI_SERVICE_KEY | 한국관광공사 TourAPI 일반 인증키 Decoding 값 | 관광·문화 검색 활성화 시 필수 |

키는 Vercel 프로젝트의 Settings → Environment Variables에 서버 변수로 등록한다. 공개 접두사 NEXT_PUBLIC_ 또는 VITE_를 붙이지 않는다. 소스나 채팅에 붙이지 않는다. 환경변수 변경 후 해당 환경을 다시 배포한다.

## TourAPI 키 발급과 등록

1. https://www.data.go.kr/data/15101578/openapi.do 에서 한국관광공사 국문 관광정보 서비스_GW의 활용 신청을 진행한다.
2. 본인 계정 로그인·신청자 정보·활용 목적·약관 동의는 계정 소유자가 확인한다.
3. 승인 상태를 확인하고 일반 인증키의 Decoding 값을 Vercel의 TOURAPI_SERVICE_KEY에 등록한다.
4. 재배포 후 데이터 스튜디오의 ‘키 등록됨’을 확인한다. 이 표시는 값 존재 여부이며 실제 호출 성공은 검색으로 별도 검증한다.
5. 공개 API 출처를 TourAPI로 바꾸고 ‘해녀’, ‘박물관’ 등으로 검색한다.

검색 엔드포인트는 공식 자료의 KorService2/searchKeyword2를 사용하며 제주 법정동 지역 조건을 적용한다. 개별 사진의 권한은 별도로 처리한다. 현재는 응답의 Type1 사진만 미리보기를 표시하고 변경 제한 등 확인이 필요한 사진은 링크 카드로 제공한다. 로고·브랜드 표장 이용 제한은 원본 제공 조건을 확인한다. 키 없이 반환한 가상 관광 자료는 없다.

## API와 데이터

- GET /api/providers: 공개 API 출처·키 필요 여부·설정 여부, 비밀 값 제외
- GET /api/search?q=...&provider=commons|openverse|tourapi&offset=...
- GET /api/state: 현재 방문자 보드 복원
- POST /api/state: 같은 Origin, 기대 버전과 바인딩 SQL로 저장

미리보기는 각 자료의 원본·작가·라이선스 링크와 함께 표시한다. 자동 수집 자료의 제주 관계·학습 권한·검수 상태를 확정으로 승격하지 않는다. 메타데이터의 라이선스가 실제 권리 보유를 보장하는 것은 아니므로 원본 근거를 확인한다. 영상 분석·생성형 AI·모델 학습은 이번 배포 범위에 없다.

## 개발과 마이그레이션

Vercel 연결과 환경변수 확인 후 다음을 실행한다.

```
node --env-file=.env.local scripts/migrate-neon.mjs
node --test tests/*.test.mjs
node build-vercel.mjs
```

Neon 마이그레이션은 user_state와 search_cache만 만들고 사용자 데이터를 시드하지 않는다. .env.local, .vercel, .local-data, 작업 폴더의 Vercel 인증 파일은 Git·배포 ZIP에서 제외한다. 기존 build.mjs는 Sites용이며 Vercel은 build-vercel.mjs를 사용한다.

## 2026-11-04 연결 검증

TourAPI 개발계정 승인 후 Production·Preview에 TOURAPI_SERVICE_KEY를 Secret으로 등록하고 Production을 재배포했다. 운영 검색 결과 12개와 공공누리 제1유형 이미지 9개의 실제 로딩을 확인했다. 개발계정 활용기간은 2026-11-04~2028-11-04이며 선택한 조회 기능별 일 1,000건이다. API 키 값은 소스에 포함하지 않는다.

## 오픈소스 추론 서버 연결

현재 상태: 연결 코드와 UI 구현 완료, 실제 추론 서버 없음. 실모델 생성·GPU 서버 구축·모델 학습은 미실행이다. 모의 응답 테스트 통과는 실모델 검증을 의미하지 않는다.

1. 별도 추론 환경에 모델 라이선스와 하드웨어 요구사항을 확인한 뒤 vLLM 등 Chat Completions 호환 서버를 운영한다. Vercel 프로젝트는 모델 서버에 요청하는 웹 앱 역할이다. 서버 제공업체 가입·GPU 유료 자원 생성은 이번 작업에서 하지 않았다.
2. 모델 서버의 외부 접근은 HTTPS와 인증으로 보호한다. 추론 서버에서 인증키를 설정하고, Vercel 서버에서 접근 가능한 /v1 기본 주소와 정확한 모델 ID를 확인한다.
3. Vercel 서버 환경변수 INFERENCE_BASE_URL(예: https://inference.example/v1), INFERENCE_MODEL(실제 모델 ID), INFERENCE_API_KEY(Secret)를 등록하고 재배포한다. 이 예시 주소는 동작하는 서버가 아니다. 브라우저에 키를 입력하지 않는다.
4. 나의 보드에 출처가 있는 자료 1~12개를 저장하고 제작 목적을 입력한 뒤 AI 기획안 생성을 실행한다. 생성 버튼에는 원본 자료 메타데이터를 추론 서버에 전달한다는 안내가 있다.
5. 실제 모델에서 한국어 출력·[번호] 인용·허위 관찰·응답 시간·오류 처리를 검증한다. 출력은 사람이 검수할 초안이다. 이미지·영상 분석 및 학습은 별도 작업이다.

GET /api/inference는 비밀 값 없이 설정 존재 여부만 반환한다. POST /api/plan은 동일 Origin에서만 허용하고 메타데이터를 서버에 전달한다. 45초 타임아웃, 리다이렉트 차단, 최대 출력 토큰 2,200이 적용된다. 현재 자료의 제목·태그·메모·라이선스·출처를 보내며 이미지 파일·개인 피드백은 전송하지 않는다. 생성 결과는 편집·복사·보드 내보내기로 보관할 수 있다. 별도 추론 운영자의 로그·보관 정책은 서버 구성 시 확인한다.

공식 프로토콜: https://docs.vllm.ai/en/stable/serving/online_serving/openai_compatible_server/
