import { createServer } from "node:http";
import { eligible, idempotencyKey, renderEmail } from "./email.mjs";
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function createTestServer(config, deps) {
  const pending = new Set();
  const lastAttempt = new Map();
  return createServer(async (req, res) => {
    const reply = (status, body) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(JSON.stringify(body));
    };
    if (req.headers.origin !== config.webOrigin) {
      reply(403, { error: "Origem não autorizada." });
      return;
    }
    res.setHeader("Access-Control-Allow-Origin", config.webOrigin);
    res.setHeader("Vary", "Origin");
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Max-Age": "600",
      });
      res.end();
      return;
    }
    if (req.method !== "POST" || req.url !== "/api/email/test") {
      reply(404, { error: "Rota não encontrada." });
      return;
    }
    let uid;
    let acquired = false;
    try {
      if (!req.headers["content-type"]?.startsWith("application/json"))
        throw new ApiError(415, "Use JSON.");
      const match = /^Bearer ([^ ]+)$/.exec(req.headers.authorization ?? "");
      if (!match) throw new ApiError(401, "Entre novamente na sua conta.");
      let user;
      try {
        user = await deps.verifyToken(match[1]);
      } catch {
        throw new ApiError(401, "Sua sessão expirou. Entre novamente.");
      }
      if (
        !user.email_verified ||
        typeof user.email !== "string" ||
        user.email.toLowerCase() !== config.testEmail
      )
        throw new ApiError(
          403,
          "Use uma conta com e-mail confirmado igual ao TEST_EMAIL do servidor.",
        );
      uid = user.uid;
      if (pending.has(uid) || Date.now() - (lastAttempt.get(uid) ?? 0) < 60000)
        throw new ApiError(429, "Aguarde um minuto entre tentativas de envio.");
      pending.add(uid);
      acquired = true;
      lastAttempt.set(uid, Date.now());
      let body = "";
      for await (const chunk of req) {
        body += chunk.toString();
        if (Buffer.byteLength(body) > 2048)
          throw new ApiError(413, "Requisição muito grande.");
      }
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        throw new ApiError(400, "JSON inválido.");
      }
      if (
        !input ||
        typeof input !== "object" ||
        Array.isArray(input) ||
        Object.keys(input).some((k) => k !== "opportunityId") ||
        typeof input.opportunityId !== "string" ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(input.opportunityId)
      )
        throw new ApiError(400, "Envie somente um opportunityId válido.");
      const token = match[1];
      // Leituras usam o token do aluno e respeitam as regras, sem chave administrativa.
      const admin = await deps.readDoc(["administradores", uid], token);
      if (admin?.data.active !== true)
        throw new ApiError(
          403,
          "Somente administradores podem solicitar o teste.",
        );
      const [profile, opportunity] = await Promise.all([
        deps.readDoc(["usuarios", uid], token),
        deps.readDoc(["oportunidades", input.opportunityId], token),
      ]);
      if (!profile || !opportunity)
        throw new ApiError(404, "Perfil ou oportunidade não encontrado.");
      if (profile.data.email?.toLowerCase() !== user.email.toLowerCase())
        throw new ApiError(
          403,
          "O e-mail do perfil não corresponde à conta autenticada.",
        );
      if (!eligible(profile.data, opportunity.data))
        throw new ApiError(
          422,
          "Ative os avisos no perfil e escolha uma oportunidade publicada, aberta e compatível com seu curso e interesses.",
        );
      const message = renderEmail(
        profile.data,
        opportunity.data,
        config.appUrl,
      );
      const key = idempotencyKey(
        uid,
        input.opportunityId,
        opportunity.revision,
      );
      const providerId = await deps.sendEmail(
        {
          from: "Oportunidades UFOP <onboarding@resend.dev>",
          to: [config.testEmail],
          ...message,
        },
        key,
      );
      reply(200, {
        message:
          "O Resend aceitou o envio. Confira sua caixa de entrada, spam e o painel do Resend.",
        providerId,
      });
    } catch (error) {
      reply(error instanceof ApiError ? error.status : 502, {
        error:
          error instanceof ApiError
            ? error.message
            : "Não foi possível confirmar o envio. Confira o painel do Resend antes de tentar novamente.",
      });
    } finally {
      if (acquired) pending.delete(uid);
    }
  });
}
