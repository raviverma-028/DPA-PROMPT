# Disease Predictor AI

B.Tech 4th Year project. Upload a medical lab report (PNG, JPG or PDF). The app reads it with a multimodal AI model, flags abnormal values, predicts **possible** conditions with a confidence level, and gives condition-wise healthy-living and diet tips.

## 1. Problem statement
Lab reports contain numbers and medical terms that most patients cannot interpret. This leads to missed early warning signs, unnecessary panic, or ignored results.

**Objectives**
1. Accept a report as image or PDF with minimal effort (drag and drop, no typing).
2. Extract key findings and mark each as Normal, Borderline or Abnormal.
3. Predict possible conditions with likelihood and confidence, never a definite diagnosis.
4. Give condition-specific tips, a diet guide and when to see a doctor.
5. Be usable by everyone: Hinglish, Hindi and English output, accessible UI.
6. Protect user data and the service: privacy by design, abuse limits, secure login.

**Scope and limitations**: awareness and education only, not a medical device. Accuracy depends on report quality and the AI model. Reports are processed in memory and never stored.

**Relevance**: supports UN SDG 3 (Good Health and Well-being) by improving health literacy.

## 2. Features
- Guest mode with 2 free analyses, then Google login (20 analyses per day, configurable)
- Drag and drop upload, multi-file, client-side image compression
- Findings table, predictions with confidence bars, tips, diet guide, doctor advice
- Print report and JSON export

## 3. Architecture
```
Browser (HTML / CSS / ES modules)
   |  multipart upload, JSON
   v
Express app (src/app.js) --- helmet CSP, rate limit, origin check, cookie identity
   |-- validate.js   file signatures + strict AI-output schema
   |-- quota.js      guest / user limits (reserve then release on failure)
   |-- db.js         JSON store, atomic writes
   |-- analyzer.js   AI API call with timeout
   '-- Google OAuth  ID token verified server-side, JWT in httpOnly cookie
```
Dependencies (AI call, Google verification, store) are injected into `createApp`, so the app is testable without network.

## 4. How the evaluation parameters are covered
| Parameter | What is implemented |
|---|---|
| **Code quality** | Modular files with single responsibility, dependency injection, JSDoc comments, ESLint config, config validation, central error handling, no duplicated logic, CI workflow |
| **Security** | Helmet + strict CSP, httpOnly/SameSite/Secure cookies, JWT (HS256 pinned, 7 days), Google token verified server-side, CSRF origin check, file type by magic bytes (not client MIME), 10 MB and 3 file limits, rate limiting, whitelisted `lang` field (prompt-injection safe), AI output validated and bounded, `textContent` only (XSS-safe), no stack traces leaked, no report logging, secrets only in `.env`, production refuses weak JWT secret |
| **Efficiency** | gzip compression, static caching, browser-side image downscaling, in-memory processing (no disk I/O), debounced atomic DB writes, AI call timeout, quota reserved before the slow call (no parallel bypass) |
| **Testing** | `npm test` (Node built-in test runner, zero extra dependencies): unit tests for validation, quota, store, prompt safety; integration tests for headers, guest limit, fake-file rejection, login, CSRF |
| **Accessibility** | Semantic landmarks, skip link, labelled controls, keyboard-operable upload, visible focus rings, `role="status"` / `role="alert"` live regions, accessible modal (focus trap, Esc, focus return), result gets focus, status never by colour alone, 44px touch targets, reduced-motion support, print stylesheet |
| **Problem alignment** | Problem statement and scope shown in the app and this README, results use "possible" wording, disclaimer and doctor advice always shown, multi-language output |

## 5. Setup
```bash
npm install
cp .env.example .env     # add ANTHROPIC_API_KEY, GOOGLE_CLIENT_ID, JWT_SECRET
npm start                # http://localhost:3000
npm test                 # run tests
npm run lint             # run ESLint
```
Requires Node.js 18+. `JWT_SECRET` must be 32+ random characters in production (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).

### Google Sign-In
1. console.cloud.google.com: create a project and configure the OAuth consent screen.
2. Credentials > Create OAuth client ID > Web application.
3. Authorized JavaScript origins: `http://localhost:3000` (and your domain after deploy).
4. Put the Client ID in `.env` as `GOOGLE_CLIENT_ID`.

## 6. API
| Method | Route | Purpose |
|---|---|---|
| POST | `/api/analyze` | multipart: `reports` (1 to 3 files), `lang` (`hinglish`, `hindi`, `english`) |
| GET | `/api/me` | current user and remaining quota |
| GET | `/api/config` | public Google client id |
| POST | `/auth/google` | exchange Google ID token for session cookie |
| POST | `/auth/logout` | clear session |
| GET | `/healthz` | health check |

## 7. Future scope
Per-user report history (database), trends across reports, lab/hospital integration, more languages, a trained ML model on structured lab values to complement the LLM.

## Disclaimer
Educational project. Not a medical diagnosis tool. Always consult a qualified doctor.
