import test from "node:test";
import assert from "node:assert/strict";
import { createTestServer } from "../src/app.mjs";
import {
  eligible,
  idempotencyKey,
  renderEmail,
  decodeFields,
} from "../src/email.mjs";
const email = "caio@example.com";
const profile = {
  email,
  name: "Caio <script>alert(1)</script>",
  emailNotifications: true,
  onboarded: true,
  course: "Sistemas de Informação",
  types: ["Bolsas"],
  areas: ["IA"],
};
const opportunity = {
  title: "Bolsa de teste",
  status: "publicada",
  deadline: "2099-10-10T18:00:00Z",
  courses: ["Sistemas de Informação"],
  areas: ["IA"],
  category: "Bolsas",
  campus: "João Monlevade",
  modality: "Presencial",
  organization: "Laboratório",
  description: "Descrição de teste",
  requirements: "Confira o edital",
  sourceUrl: "https://example.com/edital",
  applicationUrl: "",
  documents: ["Currículo"],
  remuneration: "",
};
async function fixture(patch = {}) {
  const calls = [];
  const server = createTestServer(
    {
      webOrigin: "http://localhost:5173",
      testEmail: email,
      appUrl: "http://localhost:5173",
    },
    {
      verifyToken: async () => ({ uid: "uid1", email, email_verified: true }),
      readDoc: async ([kind]) =>
        kind === "administradores"
          ? { data: { active: true } }
          : kind === "usuarios"
            ? { data: profile }
            : { data: opportunity, revision: "v1" },
      sendEmail: async (payload, key) => {
        calls.push({ payload, key });
        return "email-id";
      },
      ...patch,
    },
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const request = (body = { opportunityId: "op1" }, headers = {}) =>
    fetch(`http://127.0.0.1:${server.address().port}/api/email/test`, {
      method: "POST",
      headers: {
        Origin: "http://localhost:5173",
        "Content-Type": "application/json",
        Authorization: "Bearer teste",
        ...headers,
      },
      body: JSON.stringify(body),
    });
  return {
    calls,
    request,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  };
}
test("envio usa destinatário fixo", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.request()).status, 200);
    assert.deepEqual(f.calls[0].payload.to, [email]);
  } finally {
    await f.close();
  }
});
test("origem e token são exigidos", async () => {
  const f = await fixture();
  try {
    assert.equal(
      (await f.request({}, { Origin: "https://malicioso.example" })).status,
      403,
    );
    assert.equal((await f.request({}, { Authorization: "" })).status, 401);
    assert.equal(f.calls.length, 0);
  } finally {
    await f.close();
  }
});
test("e-mail deve ser confirmado e igual ao autorizado", async () => {
  for (const data of [
    { email, email_verified: false },
    { email: "outro@example.com", email_verified: true },
  ]) {
    const f = await fixture({
      verifyToken: async () => ({ uid: "uid1", ...data }),
    });
    try {
      assert.equal((await f.request()).status, 403);
      assert.equal(f.calls.length, 0);
    } finally {
      await f.close();
    }
  }
});
test("não administrador não envia", async () => {
  const f = await fixture({
    readDoc: async () => ({ data: { active: false } }),
  });
  try {
    assert.equal((await f.request()).status, 403);
  } finally {
    await f.close();
  }
});
test("destinatário injetado é rejeitado", async () => {
  const f = await fixture();
  try {
    assert.equal(
      (await f.request({ opportunityId: "op1", to: "outro@example.com" }))
        .status,
      400,
    );
    assert.equal(f.calls.length, 0);
  } finally {
    await f.close();
  }
});
test("preferência desativada impede envio", async () => {
  const f = await fixture({
    readDoc: async ([kind]) =>
      kind === "administradores"
        ? { data: { active: true } }
        : kind === "usuarios"
          ? { data: { ...profile, emailNotifications: false } }
          : { data: opportunity, revision: "v1" },
  });
  try {
    assert.equal((await f.request()).status, 422);
    assert.equal(f.calls.length, 0);
  } finally {
    await f.close();
  }
});
test("intervalo entre tentativas é aplicado", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.request()).status, 200);
    assert.equal((await f.request()).status, 429);
    assert.equal(f.calls.length, 1);
  } finally {
    await f.close();
  }
});
test("compatibilidade considera curso, tipo e prazo", () => {
  assert.equal(eligible(profile, opportunity), true);
  assert.equal(
    eligible(profile, { ...opportunity, status: "rascunho" }),
    false,
  );
  assert.equal(
    eligible(profile, { ...opportunity, deadline: "2000-01-01" }),
    false,
  );
  assert.equal(eligible({ ...profile, course: "Outro" }, opportunity), false);
  assert.equal(
    eligible({ ...profile, types: ["Estágios"] }, opportunity),
    false,
  );
});
test("HTML trata conteúdo como texto", () => {
  const msg = renderEmail(profile, opportunity, "http://localhost:5173");
  assert.ok(!msg.html.includes("<script>"));
  assert.ok(msg.html.includes("&lt;script&gt;"));
});
test("chave de idempotência é estável e identifica revisão", () => {
  assert.equal(
    idempotencyKey("u", "o", "v", 0),
    idempotencyKey("u", "o", "v", 1),
  );
  assert.notEqual(
    idempotencyKey("u", "o", "v", 0),
    idempotencyKey("u", "o", "v2", 0),
  );
});
test("dados do Firestore são decodificados", () =>
  assert.deepEqual(
    decodeFields({
      active: { booleanValue: true },
      areas: { arrayValue: { values: [{ stringValue: "IA" }] } },
      empty: { arrayValue: {} },
    }),
    { active: true, areas: ["IA"], empty: [] },
  ));
