import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { createTestServer, ApiError } from "./app.mjs";
import { decodeFields, safeLink } from "./email.mjs";
const {
  FIREBASE_PROJECT_ID,
  RESEND_API_KEY,
  TEST_EMAIL,
  WEB_ORIGIN,
  APP_URL,
  PORT = "3001",
} = process.env;
if (
  !FIREBASE_PROJECT_ID ||
  !RESEND_API_KEY?.startsWith("re_") ||
  !TEST_EMAIL ||
  !WEB_ORIGIN ||
  !APP_URL
)
  throw new Error("Preencha server/.env usando o .env.example.");
if (process.env.FIREBASE_AUTH_EMULATOR_HOST)
  throw new Error(
    "Remova FIREBASE_AUTH_EMULATOR_HOST. Este backend verifica contas reais para envio de teste.",
  );
const web = new URL(WEB_ORIGIN);
if (
  !["http:", "https:"].includes(web.protocol) ||
  !["localhost", "127.0.0.1"].includes(web.hostname) ||
  web.origin !== WEB_ORIGIN
)
  throw new Error(
    "WEB_ORIGIN deve ser a origem local exata do Vite, por exemplo http://localhost:5173.",
  );
const appUrl = safeLink(APP_URL);
if (!appUrl) throw new Error("APP_URL inválida.");
if (!/^[a-z0-9-]{5,63}$/.test(FIREBASE_PROJECT_ID))
  throw new Error("FIREBASE_PROJECT_ID inválido.");
const testEmail = TEST_EMAIL.trim().toLowerCase();
if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(testEmail))
  throw new Error("TEST_EMAIL inválido.");
const port = Number(PORT);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("PORT inválida.");
const app = initializeApp({ projectId: FIREBASE_PROJECT_ID });
async function readDoc(segments, token) {
  const path = segments.map(encodeURIComponent).join("/");
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (response.status === 404) return null;
  if (response.status === 401)
    throw new ApiError(401, "Sua sessão expirou. Entre novamente.");
  if (response.status === 403)
    throw new ApiError(
      403,
      "Acesso negado no Firestore. Confira as regras e sua permissão administrativa.",
    );
  if (!response.ok)
    throw new ApiError(
      502,
      "Não foi possível consultar o Firestore. Tente novamente.",
    );
  const document = await response.json();
  return {
    data: decodeFields(document.fields ?? {}),
    revision: document.updateTime,
  };
}
async function sendEmail(payload, key) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 401)
    throw new ApiError(
      502,
      "O Resend recusou a chave. Confira RESEND_API_KEY no servidor.",
    );
  if (response.status === 403)
    throw new ApiError(
      502,
      "O Resend recusou o remetente/destinatário. TEST_EMAIL deve ser o e-mail da sua conta Resend.",
    );
  if (response.status === 409)
    throw new ApiError(
      409,
      "Esta chave de teste já foi usada com outro conteúdo. Confira o envio no Resend; edite a oportunidade para testar uma nova versão.",
    );
  if (response.status === 429)
    throw new ApiError(
      429,
      "O Resend atingiu um limite de envio. Aguarde e confira sua conta.",
    );
  if (!response.ok)
    throw new ApiError(
      502,
      `O Resend não confirmou o envio (HTTP ${response.status}). Confira o painel antes de repetir.`,
    );
  const data = await response.json();
  if (typeof data.id !== "string")
    throw new Error("Resposta inválida do provedor.");
  return data.id;
}
const server = createTestServer(
  { webOrigin: WEB_ORIGIN, testEmail, appUrl },
  {
    verifyToken: (token) => getAuth(app).verifyIdToken(token),
    readDoc,
    sendEmail,
  },
);
server.requestTimeout = 30000;
server.headersTimeout = 10000;
server.listen(port, "127.0.0.1", () =>
  console.log(
    `Backend de testes em http://127.0.0.1:${port}. Destinatário fixo configurado; sem agendamento automático.`,
  ),
);
