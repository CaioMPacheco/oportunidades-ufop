import { useMemo, useState } from "react";
import type { User } from "firebase/auth";
import type { Profile } from "../../lib/profile";
import type { Opportunity } from "../../lib/opportunities";
import { isOpen, matchesProfile } from "../../lib/opportunities";

type Props = { user: User; profile: Profile; items: Opportunity[] };
export default function EmailTestPanel({ user, profile, items }: Props) {
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const options = useMemo(
    () => items.filter((item) => isOpen(item) && matchesProfile(item, profile)),
    [items, profile],
  );
  const local = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  async function send() {
    if (busy) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const base = new URL(
        import.meta.env.VITE_EMAIL_TEST_API || "http://127.0.0.1:3001",
      );
      if (
        !["localhost", "127.0.0.1"].includes(base.hostname) ||
        !["http:", "https:"].includes(base.protocol)
      )
        throw new Error(
          "O backend de testes deve usar localhost ou 127.0.0.1.",
        );
      const token = await user.getIdToken(true);
      const response = await fetch(new URL("/api/email/test", base), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ opportunityId: selected }),
        signal: AbortSignal.timeout(45000),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Não foi possível concluir o envio.");
      setNotice(data.message + " Identificador: " + data.providerId);
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Não foi possível conectar ao backend. Confira o segundo terminal, a porta e WEB_ORIGIN."
          : err instanceof Error
            ? err.message
            : "Não foi possível confirmar o envio. Confira o Resend antes de repetir.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="cat-editor"
      style={{ margin: "0 0 28px", maxWidth: "none" }}
    >
      <p className="eyebrow">LABORATÓRIO DE E-MAIL · TESTE MANUAL</p>
      <h3 style={{ marginTop: 0 }}>
        Veja uma oportunidade na sua caixa de entrada.
      </h3>
      <p className="muted">
        O teste será enviado somente ao e-mail da conta Resend configurado no
        servidor. Sua conta atual é <strong>{user.email}</strong>.
      </p>
      {!local && (
        <p className="alert error">
          Abra a versão local pelo npm run dev para usar este teste. O site
          publicado não se conecta ao backend do seu computador.
        </p>
      )}
      {!profile.emailNotifications && (
        <p className="alert error">
          Ative a preferência de e-mail em Meu perfil para testar.
        </p>
      )}
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="alert success" role="status">
          {notice}
        </p>
      )}
      <label>
        Oportunidade publicada que combina com seu perfil
        <select
          value={selected}
          disabled={busy}
          onChange={(e) => {
            setSelected(e.target.value);
            setNotice("");
            setError("");
          }}
        >
          <option value="">Selecione uma oportunidade</option>
          {options.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </label>
      {!options.length && (
        <p className="hint">
          Publique uma oportunidade com prazo futuro, curso e interesses
          compatíveis com seu perfil.
        </p>
      )}
      <button
        className="primary"
        disabled={
          !local ||
          busy ||
          !selected ||
          !options.some((item) => item.id === selected) ||
          !profile.emailNotifications
        }
        onClick={() => void send()}
      >
        {busy ? "Solicitando envio…" : "Enviar teste para meu e-mail"}
      </button>
      <p className="hint">
        Envio manual, sem campanhas ou lembretes automáticos. Aguarde um minuto
        entre tentativas. Repetir a mesma versão no mesmo dia não deve gerar
        outro e-mail; para um novo teste, edite a oportunidade.
      </p>
    </section>
  );
}
