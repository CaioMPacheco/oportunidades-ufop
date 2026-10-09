import { createHash } from "node:crypto";
export function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}
export function safeLink(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
}
export function eligible(profile, opportunity, now = Date.now()) {
  return (
    profile?.emailNotifications === true &&
    profile?.onboarded === true &&
    opportunity?.status === "publicada" &&
    Date.parse(opportunity.deadline) > now &&
    Array.isArray(opportunity.courses) &&
    (opportunity.courses.length === 0 ||
      opportunity.courses.includes(profile.course)) &&
    Array.isArray(profile.types) &&
    profile.types.includes(opportunity.category) &&
    Array.isArray(profile.areas) &&
    Array.isArray(opportunity.areas) &&
    (opportunity.areas.length === 0 ||
      opportunity.areas.some((area) => profile.areas.includes(area)))
  );
}
export function decodeValue(value) {
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("arrayValue" in value)
    return (value.arrayValue.values ?? []).map(decodeValue);
  if ("mapValue" in value) return decodeFields(value.mapValue.fields ?? {});
  return null;
}
export function decodeFields(fields) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]),
  );
}
export function idempotencyKey(uid, id, revision, now = Date.now()) {
  // Uma versão de uma oportunidade por conta e dia UTC; chave estável mesmo após reiniciar.
  return (
    "opp-test-" +
    createHash("sha256")
      .update(
        JSON.stringify([
          uid,
          id,
          revision,
          new Date(now).toISOString().slice(0, 10),
        ]),
      )
      .digest("hex")
  );
}
export function renderEmail(profile, opportunity, appUrl) {
  const source = safeLink(opportunity.sourceUrl);
  if (!source) throw new Error("Fonte inválida.");
  const application = safeLink(opportunity.applicationUrl);
  const deadline = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(opportunity.deadline));
  const title = String(opportunity.title ?? "Oportunidade").slice(0, 160);
  const documents = Array.isArray(opportunity.documents)
    ? opportunity.documents.slice(0, 15)
    : [];
  const subject = `[TESTE] ${title}`.replace(/[\r\n]/g, " ");
  const text = `OPORTUNIDADES UFOP — E-MAIL DE TESTE\n\nOlá, ${profile.name}!\n\n${title}\n${opportunity.organization}\n${opportunity.category} · ${opportunity.campus} · ${opportunity.modality}\nInscrições até ${deadline} (Brasília).\nBolsa/remuneração: ${opportunity.remuneration || "Não informado"}\n\n${opportunity.description}\n\nRequisitos:\n${opportunity.requirements}\n\nDocumentos:\n${documents.length ? documents.map((item) => "- " + item).join("\n") : "Consulte o edital."}\n\nFonte oficial: ${source}\n${application ? "Inscrição: " + application + "\n" : ""}\nRelacionada ao seu perfil. Confira todos os requisitos no edital.\n\nGerenciar ou desativar avisos: ${appUrl}\nEntre e abra Meu perfil → Desativar avisos por e-mail.\n\nEste teste foi solicitado manualmente por você. Nenhum envio automático está ativo.\nProjeto estudantil independente, sem caráter oficial da UFOP.`;
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f8f5f4;font-family:Arial,sans-serif;color:#332b32"><main style="max-width:600px;margin:24px auto;background:white;border:1px solid #eadde3;border-radius:14px;overflow:hidden"><header style="background:#78233e;color:white;padding:28px"><p style="font-size:12px;letter-spacing:2px">OPORTUNIDADES UFOP</p><h1 style="font-size:25px;margin:16px 0">Seu próximo passo começa com informação.</h1><p style="font-size:12px">Mensagem de teste · solicitada por você</p></header><section style="padding:28px"><p>Olá, ${escapeHtml(profile.name)}!</p><p style="color:#852c46;font-size:12px">${escapeHtml(opportunity.category)} · ${escapeHtml(opportunity.campus)} · ${escapeHtml(opportunity.modality)}</p><h2 style="font-size:23px">${escapeHtml(title)}</h2><p>${escapeHtml(opportunity.organization)}</p><p><strong>Inscrições até ${escapeHtml(deadline)} (Brasília)</strong></p><p>Bolsa/remuneração: ${escapeHtml(opportunity.remuneration || "Não informado")}</p><p style="white-space:pre-wrap;line-height:1.7">${escapeHtml(opportunity.description)}</p><h3>Quem pode participar?</h3><p style="white-space:pre-wrap;line-height:1.7">${escapeHtml(opportunity.requirements)}</p><h3>Prepare seus documentos</h3>${documents.length ? "<ul>" + documents.map((item) => '<li style="margin:8px 0">' + escapeHtml(item) + "</li>").join("") : "<p>Consulte o edital.</p>"}<p style="font-size:12px;line-height:1.6;background:#fff8eb;padding:14px">Esta oportunidade se relaciona ao seu perfil. Confira todos os requisitos no edital; isso não confirma sua elegibilidade.</p><p><a href="${escapeHtml(source)}" style="color:#852c46">Ler fonte oficial / edital</a></p>${application ? '<p><a href="' + escapeHtml(application) + '" style="color:#852c46">Acessar inscrição</a></p>' : ""}<hr style="border:0;border-top:1px solid #eadde3;margin:28px 0"><p style="font-size:12px;line-height:1.7">Para gerenciar ou desativar avisos, <a href="${escapeHtml(appUrl)}" style="color:#852c46">abra o site</a>, entre na conta e acesse <strong>Meu perfil</strong>.</p><p style="font-size:11px;color:#85757d">Este é um teste manual. Nenhum envio automático está ativo.<br>Projeto estudantil independente, sem caráter oficial da UFOP.</p></section></main></body></html>`;
  return { subject, text, html };
}
