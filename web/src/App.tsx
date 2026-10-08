import Catalog from "./features/catalogo/Catalog";
import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import type { User } from "firebase/auth";
import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, authReady, configured, db } from "./lib/firebase";
import {
  AREAS,
  COURSES,
  TYPES,
  TYPE_DETAILS,
  emptyProfile,
  toggle,
  validPassword,
  validProfile,
} from "./lib/profile";
import type { Profile } from "./lib/profile";

function messageFor(error: unknown) {
  const code = (error as { code?: string }).code;
  if (code === "auth/too-many-requests")
    return "Muitas tentativas. Aguarde um pouco antes de tentar novamente.";
  if (code === "auth/network-request-failed" || code === "unavailable")
    return "Não foi possível conectar. Confira sua internet e tente novamente.";
  if (code === "permission-denied")
    return "Não foi possível acessar o perfil. Confira as regras do Firestore e a confirmação do e-mail.";
  if (
    code === "auth/weak-password" ||
    code === "auth/password-does-not-meet-requirements"
  )
    return "A senha não atende à política de segurança configurada.";
  if (
    code === "auth/operation-not-allowed" ||
    code === "auth/configuration-not-found"
  )
    return "O acesso por e-mail precisa ser habilitado no Firebase deste projeto.";
  // Evita confirmar se um endereço de e-mail está cadastrado.
  return "Não foi possível concluir. Confira os dados ou tente recuperar o acesso por e-mail.";
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(configured);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<Profile>(emptyProfile);
  const [mode, setMode] = useState<"login" | "register" | "reset">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState(false);
  const [retry, setRetry] = useState(0);
  const [profileScreen, setProfileScreen] = useState(false);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (current) => {
      setProfileScreen(false);
      setUser(current);
      setVerified(current?.emailVerified ?? false);
      setProfile(null);
      setProfileLoading(!!current);
      setLoading(false);
      setDraft({ ...emptyProfile, email: current?.email ?? "" });
      setEditing(false);
      setStep(0);
    });
    void authReady.catch(() =>
      setError(
        "Seu navegador não permitiu iniciar a sessão. Verifique as configurações de armazenamento.",
      ),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    setProfileLoading(true);
    setProfileError(false);
    return onSnapshot(
      doc(db, "usuarios", user.uid),
      (snapshot) => {
        const data = snapshot.exists() ? (snapshot.data() as Profile) : null;
        setProfile(data);
        if (data) setDraft(data);
        setProfileLoading(false);
        setProfileError(false);
      },
      (err) => {
        setProfileLoading(false);
        setProfileError(true);
        setError(messageFor(err));
      },
    );
  }, [user, retry]);

  async function action(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }
  function changeMode(value: typeof mode) {
    setMode(value);
    setError("");
    setNotice("");
    setPassword("");
    setConfirm("");
  }
  async function saveInitial(current: User, value: Profile) {
    await setDoc(doc(db!, "usuarios", current.uid), {
      ...emptyProfile,
      name: value.name.trim(),
      course: value.course,
      email: current.email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      consentUpdatedAt: serverTimestamp(),
    });
  }
  function submitAuth(event: FormEvent) {
    event.preventDefault();
    if (!auth || !db) {
      setError("Conecte seu projeto Firebase seguindo o arquivo INICIAR.md.");
      return;
    }
    if (
      mode === "register" &&
      (!validPassword(password) || password !== confirm)
    ) {
      setError(
        password !== confirm
          ? "As senhas precisam ser iguais."
          : "Use 12 a 128 caracteres, com maiúscula, minúscula, número e símbolo.",
      );
      return;
    }
    void action(async () => {
      await authReady;
      if (mode === "reset") {
        try {
          await sendPasswordResetEmail(auth!, email.trim());
        } catch (err) {
          if ((err as { code?: string }).code !== "auth/user-not-found")
            throw err;
        }
        setNotice(
          "Se houver uma conta para esse endereço, você receberá as instruções. Confira também o spam.",
        );
        return;
      }
      if (mode === "login") {
        await signInWithEmailAndPassword(auth!, email.trim(), password);
        setPassword("");
        return;
      }
      const created = await createUserWithEmailAndPassword(
        auth!,
        email.trim(),
        password,
      );
      setPassword("");
      setConfirm("");
      // Auth e Firestore não são uma transação: se a gravação falhar,
      // a próxima entrada permite completar o perfil da conta já criada.
      await saveInitial(created.user, draft);
      try {
        await sendEmailVerification(created.user);
        setNotice(
          "Conta criada. Enviamos um link de confirmação para seu e-mail.",
        );
      } catch {
        setNotice(
          "Conta e perfil criados. Use “Reenviar confirmação” para solicitar o e-mail.",
        );
      }
    });
  }
  function submitProfile(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    void action(async () => {
      await saveInitial(user, draft);
      setNotice("Perfil salvo. Confirme seu e-mail para continuar.");
    });
  }
  function finish() {
    if (!user || !validProfile(draft)) {
      setError(
        "Confira nome, curso e selecione ao menos uma área e um tipo de oportunidade.",
      );
      return;
    }
    void action(async () => {
      await updateDoc(doc(db!, "usuarios", user.uid), {
        name: draft.name.trim(),
        course: draft.course,
        areas: draft.areas,
        types: draft.types,
        emailNotifications: draft.emailNotifications,
        frequency: draft.frequency,
        onboarded: true,
        updatedAt: serverTimestamp(),
        consentUpdatedAt: serverTimestamp(),
      });
      setEditing(false);
      setNotice(
        "Suas preferências foram salvas. Você pode alterá-las quando quiser.",
      );
    });
  }
  const nameAndCourse = (
    <>
      <label>
        Como podemos chamar você?
        <input
          required
          minLength={2}
          maxLength={100}
          autoComplete="name"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="Seu nome completo"
        />
      </label>
      <label>
        Qual é o seu curso?
        <select
          required
          value={draft.course}
          onChange={(e) => setDraft({ ...draft, course: e.target.value })}
        >
          <option value="" disabled>
            Selecione seu curso
          </option>
          {COURSES.map((course) => (
            <option key={course}>{course}</option>
          ))}
        </select>
      </label>
    </>
  );
  let content: ReactNode;
  if (loading || profileLoading)
    content = (
      <div className="waiting" role="status">
        Carregando sua jornada…
      </div>
    );
  else if (!user)
    content = (
      <>
        <div className="tabs" aria-label="Acesso">
          <button
            type="button"
            disabled={busy}
            className={mode !== "login" ? "active" : ""}
            onClick={() => changeMode("register")}
          >
            Criar conta
          </button>
          <button
            type="button"
            disabled={busy}
            className={mode === "login" ? "active" : ""}
            onClick={() => changeMode("login")}
          >
            Já tenho conta
          </button>
        </div>
        <p className="eyebrow">SEU PRÓXIMO PASSO COMEÇA AQUI</p>
        <h2>
          {mode === "register"
            ? "Vamos nos conhecer?"
            : mode === "reset"
              ? "Recupere seu acesso."
              : "Bom ter você de volta."}
        </h2>
        <p className="muted">
          {mode === "register"
            ? "Crie sua conta e conte o que você quer explorar."
            : mode === "reset"
              ? "Enviaremos as instruções para seu e-mail."
              : "Entre para continuar sua jornada acadêmica."}
        </p>
        {!configured && (
          <div className="setup">
            Configuração pendente: preencha o arquivo <code>web/.env</code>{" "}
            conforme o guia incluído. Nenhum cadastro será simulado.
          </div>
        )}
        <form onSubmit={submitAuth}>
          <fieldset disabled={busy}>
            {mode === "register" && nameAndCourse}
            <label>
              Seu e-mail
              <input
                required
                type="email"
                maxLength={254}
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
              />
            </label>
            {mode !== "reset" && (
              <>
                <label>
                  Senha da sua conta Oportunidades
                  <div className="password">
                    <input
                      required
                      type={visible ? "text" : "password"}
                      minLength={mode === "register" ? 12 : 1}
                      maxLength={128}
                      autoComplete={
                        mode === "register"
                          ? "new-password"
                          : "current-password"
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                      onClick={() => setVisible(!visible)}
                    >
                      {visible ? "Ocultar" : "Mostrar"}
                    </button>
                  </div>
                </label>
                {mode === "register" && (
                  <>
                    <p className="hint">
                      Pelo menos 12 caracteres, com maiúscula, minúscula, número
                      e símbolo. Crie uma senha exclusiva para este projeto.
                    </p>
                    <label>
                      Confirme sua senha
                      <input
                        required
                        type={visible ? "text" : "password"}
                        minLength={12}
                        maxLength={128}
                        autoComplete="new-password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                      />
                    </label>
                  </>
                )}
              </>
            )}
            <button className="primary" disabled={!configured || busy}>
              {busy
                ? "Aguarde…"
                : mode === "register"
                  ? "Criar minha conta →"
                  : mode === "reset"
                    ? "Enviar instruções"
                    : "Entrar →"}
            </button>
          </fieldset>
        </form>
        {mode === "login" && (
          <button
            disabled={busy}
            className="text-button"
            onClick={() => changeMode("reset")}
          >
            Esqueci minha senha
          </button>
        )}
        {mode === "reset" && (
          <button
            disabled={busy}
            className="text-button"
            onClick={() => changeMode("login")}
          >
            Voltar para o login
          </button>
        )}
        <p className="privacy">
          Seu nome, curso e interesses serão usados para personalizar as
          oportunidades. Os avisos por e-mail são opcionais.
        </p>
        <div className="future">
          <span>UMA IDEIA PARA O FUTURO</span>
          <strong>
            Entrar com MinhaUFOP <small>Planejado</small>
          </strong>
          <p>A integração institucional ainda está em estudo.</p>
        </div>
      </>
    );
  else if (profileError)
    content = (
      <>
        <h2>Não conseguimos carregar seu perfil.</h2>
        <p className="muted">
          Seus dados não foram substituídos. Você pode tentar novamente.
        </p>
        <button
          className="primary"
          onClick={() => {
            setError("");
            setRetry(retry + 1);
          }}
        >
          Tentar novamente
        </button>
      </>
    );
  else if (!profile)
    content = (
      <>
        <p className="eyebrow">COMPLETE SEU CADASTRO</p>
        <h2>Falta só o seu perfil.</h2>
        <p className="muted">
          Sua conta já existe. Salve seu nome e curso para continuar.
        </p>
        <form onSubmit={submitProfile}>
          <fieldset disabled={busy}>
            {nameAndCourse}
            <button className="primary">
              {busy ? "Salvando…" : "Salvar perfil →"}
            </button>
          </fieldset>
        </form>
      </>
    );
  else if (!verified)
    content = (
      <>
        <div className="mail-icon" aria-hidden="true">
          ✉
        </div>
        <p className="eyebrow">CONFIRMAÇÃO DE E-MAIL</p>
        <h2>Confira sua caixa de entrada.</h2>
        <p className="muted">
          Confirme o endereço <strong>{user.email}</strong> pelo link enviado.
          Depois, volte aqui para escolher seus interesses.
        </p>
        <button
          className="primary"
          disabled={busy}
          onClick={() =>
            void action(async () => {
              await user.reload();
              await user.getIdToken(true);
              setVerified(user.emailVerified);
              if (!user.emailVerified)
                setNotice(
                  "Seu e-mail ainda não está confirmado. Abra o link recebido e tente novamente.",
                );
            })
          }
        >
          {busy ? "Verificando…" : "Já confirmei meu e-mail →"}
        </button>
        <button
          className="text-button"
          disabled={busy}
          onClick={() =>
            void action(async () => {
              await sendEmailVerification(user);
              setNotice(
                "Enviamos um novo link. Confira também a pasta de spam.",
              );
            })
          }
        >
          Reenviar confirmação
        </button>
      </>
    );
  else if (!profile.onboarded || editing)
    content = (
      <>
        <div className="steps" aria-label={`Etapa ${step + 1} de 3`}>
          {["Áreas", "Oportunidades", "E-mail"].map((label, i) => (
            <span className={i <= step ? "current" : ""} key={label}>
              <b>{i + 1}</b>
              {label}
            </span>
          ))}
        </div>
        <p className="eyebrow">UM PERFIL COM A SUA CARA</p>
        <h2>
          {
            [
              "O que desperta sua curiosidade?",
              "Que caminhos você quer explorar?",
              "Como quer receber novidades?",
            ][step]
          }
        </h2>
        <p className="muted">
          {step < 2
            ? "Você pode escolher mais de uma opção e mudar depois."
            : "Você decide se quer receber avisos por e-mail."}
        </p>
        <fieldset disabled={busy}>
          {step === 0 && (
            <>
              <div className="profile-fields">{nameAndCourse}</div>
              <div className="choices">
                {AREAS.map((area, i) => (
                  <label
                    className={`choice ${draft.areas.includes(area) ? "selected" : ""}`}
                    key={area}
                  >
                    <input
                      type="checkbox"
                      checked={draft.areas.includes(area)}
                      onChange={() =>
                        setDraft({ ...draft, areas: toggle(draft.areas, area) })
                      }
                    />
                    <span>
                      <small>0{i + 1}</small>
                      <strong>{area}</strong>
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}
          {step === 1 && (
            <div className="choices types">
              {TYPES.map((type, i) => (
                <label
                  className={`choice ${draft.types.includes(type) ? "selected" : ""}`}
                  key={type}
                >
                  <input
                    type="checkbox"
                    checked={draft.types.includes(type)}
                    onChange={() =>
                      setDraft({ ...draft, types: toggle(draft.types, type) })
                    }
                  />
                  <span>
                    <strong>{type}</strong>
                    <em>{TYPE_DETAILS[i]}</em>
                  </span>
                </label>
              ))}
            </div>
          )}
          {step === 2 && (
            <>
              <div className="email-card">
                <span className="mail-icon" aria-hidden="true">
                  ✉
                </span>
                <strong>Novidades na sua caixa de entrada</strong>
                <p>{user.email}</p>
                <label className="consent">
                  <input
                    type="checkbox"
                    checked={draft.emailNotifications}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        emailNotifications: e.target.checked,
                      })
                    }
                  />
                  Quero receber oportunidades e lembretes por e-mail.
                </label>
              </div>
              {draft.emailNotifications && (
                <label>
                  Frequência desejada
                  <select
                    value={draft.frequency}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        frequency: e.target.value as Profile["frequency"],
                      })
                    }
                  >
                    <option value="semanal">Resumo semanal</option>
                    <option value="diaria">Resumo diário</option>
                  </select>
                </label>
              )}
              <p className="hint">
                Você pode desativar esta preferência a qualquer momento. O envio
                de oportunidades ainda será ativado em uma próxima etapa.
              </p>
            </>
          )}
          <div className="actions">
            {step > 0 && (
              <button
                className="secondary"
                onClick={() => {
                  setStep(step - 1);
                  setError("");
                }}
              >
                Voltar
              </button>
            )}
            {step < 2 ? (
              <button
                className="primary"
                disabled={
                  step === 0
                    ? draft.areas.length === 0 ||
                      draft.name.trim().length < 2 ||
                      !draft.course
                    : draft.types.length === 0
                }
                onClick={() => {
                  setStep(step + 1);
                  setError("");
                }}
              >
                Continuar →
              </button>
            ) : (
              <button className="primary" onClick={finish}>
                {busy ? "Salvando…" : "Concluir meu perfil →"}
              </button>
            )}
          </div>
          {editing && (
            <button
              className="text-button"
              onClick={() => {
                setDraft(profile);
                setEditing(false);
                setError("");
              }}
            >
              Cancelar alterações
            </button>
          )}
        </fieldset>
      </>
    );
  else
    content = (
      <>
        <button className="text-button" onClick={() => setProfileScreen(false)}>
          ← Voltar às oportunidades
        </button>
        <span className="done-icon" aria-hidden="true">
          ✓
        </span>
        <p className="eyebrow">SEU PERFIL ESTÁ PRONTO</p>
        <h2>Seu próximo passo, {profile.name.split(" ")[0]}.</h2>
        <p className="muted">
          Preferências salvas. Este será o ponto de partida para encontrar
          oportunidades que fazem sentido para você.
        </p>
        <div className="summary">
          <span>SEU CURSO</span>
          <strong>{profile.course}</strong>
          <span>ÁREAS DE INTERESSE</span>
          <div className="chips">
            {profile.areas.map((area) => (
              <b key={area}>{area}</b>
            ))}
          </div>
          <span>QUERO EXPLORAR</span>
          <div className="chips">
            {profile.types.map((type) => (
              <b key={type}>{type}</b>
            ))}
          </div>
          <span>AVISOS POR E-MAIL</span>
          <strong>
            {profile.emailNotifications
              ? `Interesse registrado · resumo ${profile.frequency === "diaria" ? "diário" : "semanal"}`
              : "Desativados"}
          </strong>
          <p className="hint">
            O catálogo está disponível. Os envios de oportunidades por e-mail
            serão ativados em uma próxima etapa.
          </p>
        </div>
        <button
          className="primary"
          disabled={busy}
          onClick={() => {
            setDraft(profile);
            setStep(0);
            setEditing(true);
            setNotice("");
          }}
        >
          Editar perfil e preferências
        </button>
        {profile.emailNotifications && (
          <button
            disabled={busy}
            className="text-button"
            onClick={() =>
              void action(async () => {
                await updateDoc(doc(db!, "usuarios", user.uid), {
                  emailNotifications: false,
                  consentUpdatedAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
                setNotice("Preferência de e-mail desativada.");
              })
            }
          >
            Desativar avisos por e-mail
          </button>
        )}
      </>
    );

  if (
    user &&
    verified &&
    profile?.onboarded &&
    !editing &&
    !profileScreen &&
    !profileLoading &&
    !profileError
  ) {
    return (
      <Catalog
        user={user}
        profile={profile}
        onProfile={() => setProfileScreen(true)}
        onLogout={async () => {
          await signOut(auth!);
          setPassword("");
          setConfirm("");
          setEmail("");
          setMode("login");
        }}
      />
    );
  }

  return (
    <div className="app">
      <header>
        <a href="/" className="brand">
          <span className="brand-mark">o.</span>
          <span>
            oportunidades<strong>UFOP</strong>
          </span>
        </a>
        <span className="project-label">FEITO PARA QUEM QUER IR ALÉM</span>
        {user && (
          <button
            disabled={busy}
            className="logout"
            onClick={() =>
              void action(async () => {
                await signOut(auth!);
                setPassword("");
                setConfirm("");
                setEmail("");
                setMode("login");
                setNotice("Sessão encerrada.");
              })
            }
          >
            Sair ↗
          </button>
        )}
      </header>
      <main className="layout">
        <aside className="story">
          <div className="story-top">
            <span className="pill">SEU FUTURO TEM POSSIBILIDADES</span>
            <h1>
              O conhecimento
              <br />
              abre portas.
              <br />
              <i>
                A informação
                <br />
                mostra o caminho.
              </i>
            </h1>
            <p>
              Bolsas, projetos e experiências.
              <br />
              Descubra o que combina com a sua jornada.
            </p>
          </div>
          <div className="orbit-art" aria-hidden="true">
            <div className="orbit orbit-one"></div>
            <div className="orbit orbit-two"></div>
            <div className="orbit orbit-three"></div>
            <div className="orbit-center">↗</div>
            <span className="orbit-label label-one">Novos caminhos</span>
            <span className="orbit-label label-two">Novas descobertas</span>
          </div>
          <div className="story-bottom">
            <span>01 / CONECTAR</span>
            <p>
              A oportunidade certa começa
              <br />
              com informação que chega até você.
            </p>
          </div>
        </aside>
        <section className="panel" aria-label="Acesso e perfil">
          <div className="panel-inner">
            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}
            {notice && (
              <div className="alert success" role="status">
                {notice}
              </div>
            )}
            {content}
          </div>
        </section>
      </main>
      <footer>
        <span>Oportunidades UFOP · Projeto estudantil</span>
        <span>Uma iniciativa educacional independente.</span>
      </footer>
    </div>
  );
}
