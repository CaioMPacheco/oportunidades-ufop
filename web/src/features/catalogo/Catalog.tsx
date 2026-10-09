import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../../lib/firebase";
import { TYPES, COURSES, toggle } from "../../lib/profile";
import type { Profile } from "../../lib/profile";
import {
  CAMPUSES,
  TRACKING_STATES,
  cleanChecklist,
  formatDeadline,
  initialTracking,
  isOpen,
  matchesProfile,
  normalize,
  safeUrl,
} from "../../lib/opportunities";
import type { Opportunity, Tracking } from "../../lib/opportunities";
import AdminForm from "./AdminForm";
import EmailTestPanel from "./EmailTestPanel";
import "./Catalog.css";

type Props = {
  user: User;
  profile: Profile;
  onProfile: () => void;
  onLogout: () => Promise<void>;
};
export default function Catalog({ user, profile, onProfile, onLogout }: Props) {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [saved, setSaved] = useState<Record<string, Tracking>>({});
  const [admin, setAdmin] = useState(false);
  const [adminReady, setAdminReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savedLoading, setSavedLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [savedError, setSavedError] = useState("");
  const [roleError, setRoleError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"explore" | "saved" | "admin">("explore");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [campus, setCampus] = useState("");
  const [course, setCourse] = useState("");
  const [personal, setPersonal] = useState(false);
  const [closed, setClosed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [editor, setEditor] = useState<Opportunity | null | undefined>(
    undefined,
  );
  const [now, setNow] = useState(Date.now());
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);
  useEffect(
    () =>
      onSnapshot(
        doc(db!, "administradores", user.uid),
        (snap) => {
          setAdmin(snap.exists() && snap.data().active === true);
          setAdminReady(true);
          setRoleError("");
        },
        () => {
          setAdmin(false);
          setAdminReady(true);
          setRoleError(
            "Não foi possível verificar a administração. Confira se as novas regras foram publicadas.",
          );
        },
      ),
    [user.uid, retry],
  );
  useEffect(() => {
    if (!adminReady) return;
    setLoading(true);
    setLoadError("");
    const source = admin
      ? collection(db!, "oportunidades")
      : query(
          collection(db!, "oportunidades"),
          where("status", "in", ["publicada", "encerrada"]),
        );
    return onSnapshot(
      source,
      (snapshot) => {
        setItems(
          snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as Opportunity),
        );
        setLoading(false);
      },
      () => {
        setLoading(false);
        setItems([]);
        setLoadError(
          "Não foi possível carregar as oportunidades. Confira a conexão e as regras do Firestore.",
        );
      },
    );
  }, [admin, adminReady, retry]);
  useEffect(() => {
    setSavedLoading(true);
    return onSnapshot(
      collection(db!, "usuarios", user.uid, "acompanhamentos"),
      (snapshot) => {
        setSaved(
          Object.fromEntries(
            snapshot.docs.map((d) => [d.id, d.data() as Tracking]),
          ),
        );
        setSavedLoading(false);
        setSavedError("");
      },
      () => {
        setSavedLoading(false);
        setSavedError(
          "Não foi possível carregar seus acompanhamentos. Tente novamente antes de salvar alterações.",
        );
      },
    );
  }, [user.uid, retry]);
  useEffect(() => {
    if (!admin) {
      setEditor(undefined);
      setTab((t) => (t === "admin" ? "explore" : t));
    }
  }, [admin]);
  useEffect(() => {
    setSelected(null);
    setEditor(undefined);
    setError("");
    setNotice("");
  }, [tab]);
  async function action(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch {
      setError(
        "Não foi possível concluir. Confira sua conexão e tente novamente. Se persistir, confira as regras do banco.",
      );
    } finally {
      setBusy(false);
    }
  }
  const trackingRef = (id: string) =>
    doc(db!, "usuarios", user.uid, "acompanhamentos", id);
  async function writeTracking(item: Opportunity, value: Tracking) {
    await setDoc(trackingRef(item.id), {
      status: value.status,
      checkedDocuments: cleanChecklist(value.checkedDocuments, item.documents),
      updatedAt: serverTimestamp(),
    });
  }
  function save(item: Opportunity) {
    void action(async () => {
      await writeTracking(item, initialTracking);
      setNotice(
        "Oportunidade salva. Você pode acompanhar os documentos em Minhas oportunidades.",
      );
    });
  }
  function updateTracking(item: Opportunity, value: Tracking) {
    void action(async () => {
      await writeTracking(item, value);
      setNotice("Acompanhamento atualizado.");
    });
  }
  function remove(id: string) {
    if (
      !window.confirm(
        "Remover dos seus acompanhamentos? O checklist e a situação desta oportunidade serão apagados.",
      )
    )
      return;
    void action(async () => {
      await deleteDoc(trackingRef(id));
      setNotice("Oportunidade removida dos seus acompanhamentos.");
    });
  }
  const publicItems = items.filter((item) => item.status !== "rascunho");
  const list = useMemo(() => {
    const source = tab === "admin" ? items : publicItems;
    return source
      .filter((item) => {
        if (tab === "saved") return !!saved[item.id];
        if (tab === "admin")
          return normalize(`${item.title} ${item.organization}`).includes(
            normalize(search),
          );
        return (
          (closed || isOpen(item, now)) &&
          (!personal || matchesProfile(item, profile)) &&
          (!category || item.category === category) &&
          (!campus ||
            item.campus === campus ||
            item.campus === "Todos os campi") &&
          (!course ||
            item.courses.length === 0 ||
            item.courses.includes(course)) &&
          normalize(
            `${item.title} ${item.organization} ${item.description}`,
          ).includes(normalize(search))
        );
      })
      .sort((a, b) => {
        const state = Number(isOpen(b, now)) - Number(isOpen(a, now));
        if (state) return state;
        return a.deadline.toMillis() - b.deadline.toMillis();
      });
  }, [
    items,
    saved,
    tab,
    search,
    category,
    campus,
    course,
    personal,
    closed,
    profile,
    now,
  ]);
  const detail = items.find(
    (item) => item.id === selected && (admin || item.status !== "rascunho"),
  );
  const missingSaved = Object.keys(saved).filter(
    (id) => !publicItems.some((item) => item.id === id),
  );
  const badge = (item: Opportunity) =>
    item.status === "rascunho"
      ? "Rascunho"
      : isOpen(item, now)
        ? "Inscrições abertas"
        : "Encerrada";
  const savedCount = Object.keys(saved).length;
  return (
    <div className="catalog-app">
      <header className="cat-header">
        <a className="brand" href="/">
          <span className="brand-mark">o.</span>
          <span>
            oportunidades<strong>UFOP</strong>
          </span>
        </a>
        <div className="cat-user">
          <span>
            Olá, <strong>{profile.name.split(" ")[0]}</strong>
          </span>
          <button onClick={onProfile} disabled={busy}>
            Meu perfil
          </button>
          <button disabled={busy} onClick={() => void action(onLogout)}>
            Sair ↗
          </button>
        </div>
      </header>
      <main className="cat-main">
        <section className="cat-hero">
          <div>
            <p className="eyebrow">CONHECIMENTO EM MOVIMENTO</p>
            <h1>
              Seu próximo capítulo
              <br />
              <i>pode começar aqui.</i>
            </h1>
            <p>
              Explore oportunidades, prepare seus documentos
              <br />e acompanhe cada passo da sua jornada.
            </p>
          </div>
          <div className="cat-hero-note">
            <span aria-hidden="true">↗</span>
            <p>
              A informação certa.
              <br />
              Um mundo de possibilidades.
            </p>
          </div>
        </section>
        <nav className="cat-nav" aria-label="Seções">
          <button
            className={tab === "explore" ? "active" : ""}
            onClick={() => setTab("explore")}
          >
            Explorar
          </button>
          <button
            className={tab === "saved" ? "active" : ""}
            onClick={() => setTab("saved")}
          >
            Minhas oportunidades <b>{savedLoading ? "…" : savedCount}</b>
          </button>
          {admin && (
            <button
              className={tab === "admin" ? "active" : ""}
              onClick={() => setTab("admin")}
            >
              Administração
            </button>
          )}
        </nav>
        {[roleError, loadError, savedError, error]
          .filter(Boolean)
          .map((text, i) => (
            <div className="alert error" role="alert" key={i}>
              {text}
            </div>
          ))}
        {(loadError || savedError || roleError) && (
          <button className="cat-link" onClick={() => setRetry(retry + 1)}>
            Tentar carregar novamente
          </button>
        )}
        {notice && (
          <div className="alert success" role="status">
            {notice}
          </div>
        )}
        {editor !== undefined && admin ? (
          <AdminForm
            key={editor?.id ?? "new"}
            uid={user.uid}
            item={editor}
            onCancel={() => setEditor(undefined)}
            onDone={() => {
              setEditor(undefined);
              setSelected(null);
              setNotice("Oportunidade salva no banco de dados.");
            }}
          />
        ) : selected ? (
          <section className="cat-detail">
            <button className="cat-link" onClick={() => setSelected(null)}>
              ← Voltar à lista
            </button>
            {!detail ? (
              <div className="cat-empty">
                <h2>Oportunidade indisponível.</h2>
                <p>
                  Ela pode ter sido retirada de publicação. Seu acompanhamento
                  permanece salvo.
                </p>
              </div>
            ) : (
              <>
                <div className="cat-detail-heading">
                  <div>
                    <span className="cat-category">{detail.category}</span>
                    <h2>{detail.title}</h2>
                    <p className="muted">
                      {detail.organization} · {detail.campus} ·{" "}
                      {detail.modality}
                    </p>
                  </div>
                  <span
                    className={`cat-status ${isOpen(detail, now) ? "open" : ""}`}
                  >
                    {badge(detail)}
                  </span>
                </div>
                <div className="cat-detail-grid">
                  <article>
                    <div className="cat-facts">
                      <div>
                        <span>INSCRIÇÕES ATÉ</span>
                        <strong>{formatDeadline(detail.deadline)}</strong>
                        <small>Horário de Brasília</small>
                      </div>
                      <div>
                        <span>BOLSA / REMUNERAÇÃO</span>
                        <strong>
                          {detail.remuneration || "Não informado"}
                        </strong>
                      </div>
                    </div>
                    <h3>Sobre a oportunidade</h3>
                    <p className="cat-prose">{detail.description}</p>
                    <h3>Quem pode participar?</h3>
                    <p className="cat-prose">{detail.requirements}</p>
                    <p>
                      <strong>Cursos:</strong>{" "}
                      {detail.courses.length
                        ? detail.courses.join(", ")
                        : "Todos os cursos"}
                    </p>
                    {detail.areas.length > 0 && (
                      <div className="chips">
                        {detail.areas.map((area) => (
                          <b key={area}>{area}</b>
                        ))}
                      </div>
                    )}
                    <div className="cat-notice">
                      A compatibilidade usa seu curso e interesses. Confira
                      todos os requisitos no edital; ela não confirma sua
                      elegibilidade.
                    </div>
                    <div className="cat-source-links">
                      {safeUrl(detail.sourceUrl) && (
                        <a
                          href={safeUrl(detail.sourceUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Ler fonte oficial / edital ↗
                        </a>
                      )}
                      {isOpen(detail, now) &&
                        safeUrl(detail.applicationUrl) && (
                          <a
                            className="cat-solid"
                            href={safeUrl(detail.applicationUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Ir para inscrição ↗
                          </a>
                        )}
                    </div>
                  </article>
                  <aside className="cat-checklist">
                    <h3>Prepare seu próximo passo</h3>
                    <p>Organize os documentos antes de se inscrever.</p>
                    {savedLoading ? (
                      <p role="status">Carregando acompanhamento…</p>
                    ) : !saved[detail.id] ? (
                      <>
                        <ul>
                          {detail.documents.map((label) => (
                            <li key={label}>{label}</li>
                          ))}
                        </ul>
                        {!detail.documents.length && (
                          <p>Documentos não informados. Consulte o edital.</p>
                        )}
                        <button
                          className="primary"
                          disabled={
                            busy || !!savedError || detail.status === "rascunho"
                          }
                          onClick={() => save(detail)}
                        >
                          Salvar e iniciar checklist
                        </button>
                      </>
                    ) : (
                      <>
                        <label>
                          Sua situação
                          <select
                            disabled={busy || !!savedError}
                            value={saved[detail.id].status}
                            onChange={(e) =>
                              updateTracking(detail, {
                                ...saved[detail.id],
                                status: e.target.value,
                              })
                            }
                          >
                            {TRACKING_STATES.map((state) => (
                              <option key={state}>{state}</option>
                            ))}
                          </select>
                        </label>
                        <p className="hint">
                          “Inscrição realizada” é uma marcação sua. O sistema
                          não confirma a inscrição no site externo.
                        </p>
                        {detail.documents.map((label) => (
                          <label className="cat-check" key={label}>
                            <input
                              type="checkbox"
                              disabled={busy || !!savedError}
                              checked={saved[
                                detail.id
                              ].checkedDocuments.includes(label)}
                              onChange={() =>
                                updateTracking(detail, {
                                  ...saved[detail.id],
                                  checkedDocuments: toggle(
                                    saved[detail.id].checkedDocuments,
                                    label,
                                  ),
                                })
                              }
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                        {!detail.documents.length && (
                          <p>Consulte o edital para verificar os documentos.</p>
                        )}
                        <small>
                          {
                            cleanChecklist(
                              saved[detail.id].checkedDocuments,
                              detail.documents,
                            ).length
                          }{" "}
                          de {detail.documents.length} documentos preparados
                        </small>
                        <button
                          className="text-button"
                          disabled={busy || !!savedError}
                          onClick={() => remove(detail.id)}
                        >
                          Remover dos meus acompanhamentos
                        </button>
                      </>
                    )}
                    <p className="hint">
                      A checklist guarda apenas suas marcações, sem receber
                      arquivos pessoais.
                    </p>
                  </aside>
                </div>
                {admin && (
                  <button
                    className="secondary"
                    onClick={() => setEditor(detail)}
                  >
                    Editar esta oportunidade
                  </button>
                )}
              </>
            )}
          </section>
        ) : (
          <>
            {tab === "admin" && (
              <EmailTestPanel user={user} profile={profile} items={items} />
            )}
            <section className="cat-list-heading">
              <div>
                <p className="eyebrow">
                  {tab === "saved"
                    ? "DO INTERESSE À AÇÃO"
                    : tab === "admin"
                      ? "INFORMAÇÃO QUE ABRE PORTAS"
                      : "ENCONTRE SEU CAMINHO"}
                </p>
                <h2>
                  {tab === "saved"
                    ? "Seu acompanhamento"
                    : tab === "admin"
                      ? "Gerenciar oportunidades"
                      : "Oportunidades para explorar"}
                </h2>
              </div>
              {tab === "admin" && (
                <button className="cat-solid" onClick={() => setEditor(null)}>
                  + Nova oportunidade
                </button>
              )}
            </section>
            {tab !== "saved" && (
              <div className="cat-filters">
                <label className="cat-search">
                  Buscar
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Título, organização ou palavra-chave"
                  />
                </label>
                {tab === "explore" && (
                  <>
                    <label>
                      Tipo
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      >
                        <option value="">Todos os tipos</option>
                        {TYPES.map((type) => (
                          <option key={type}>{type}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Campus
                      <select
                        value={campus}
                        onChange={(e) => setCampus(e.target.value)}
                      >
                        <option value="">Todos</option>
                        {CAMPUSES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Curso
                      <select
                        value={course}
                        onChange={(e) => setCourse(e.target.value)}
                      >
                        <option value="">Todos</option>
                        {COURSES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <div className="cat-filter-options">
                      <label>
                        <input
                          type="checkbox"
                          checked={personal}
                          onChange={(e) => setPersonal(e.target.checked)}
                        />
                        Combina com meu perfil
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={closed}
                          onChange={(e) => setClosed(e.target.checked)}
                        />
                        Mostrar encerradas
                      </label>
                      <button
                        className="cat-link"
                        onClick={() => {
                          setSearch("");
                          setCategory("");
                          setCampus("");
                          setCourse("");
                          setPersonal(false);
                          setClosed(false);
                        }}
                      >
                        Limpar filtros
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {loading || !adminReady || (tab === "saved" && savedLoading) ? (
              <p className="waiting" role="status">
                Carregando oportunidades…
              </p>
            ) : (
              !loadError && (
                <>
                  <p className="cat-count">
                    {list.length}{" "}
                    {list.length === 1
                      ? "oportunidade encontrada"
                      : "oportunidades encontradas"}
                  </p>
                  <div className="cat-grid">
                    {list.map((item) => (
                      <article className="cat-card" key={item.id}>
                        <div className="cat-card-top">
                          <span className="cat-category">{item.category}</span>
                          <span
                            className={`cat-status ${isOpen(item, now) ? "open" : ""}`}
                          >
                            {badge(item)}
                          </span>
                        </div>
                        <p className="cat-organization">{item.organization}</p>
                        <h3>{item.title}</h3>
                        <p className="cat-location">
                          {item.campus} · {item.modality}
                        </p>
                        <p className="cat-excerpt">{item.description}</p>
                        <div className="cat-card-meta">
                          <span>
                            Até {formatDeadline(item.deadline)}{" "}
                            <small>Brasília</small>
                          </span>
                          <strong>
                            {item.remuneration || "Remuneração não informada"}
                          </strong>
                        </div>
                        {matchesProfile(item, profile) && (
                          <span className="cat-match">
                            Relacionado ao seu perfil
                          </span>
                        )}
                        {tab === "saved" && saved[item.id] && (
                          <div className="cat-progress">
                            <strong>{saved[item.id].status}</strong>
                            <span>
                              {
                                cleanChecklist(
                                  saved[item.id].checkedDocuments,
                                  item.documents,
                                ).length
                              }
                              /{item.documents.length} documentos
                            </span>
                          </div>
                        )}
                        <div className="cat-card-actions">
                          <button
                            className="cat-link"
                            onClick={() => setSelected(item.id)}
                          >
                            Ver detalhes →
                          </button>
                          {tab === "admin" ? (
                            <button
                              className="cat-save"
                              onClick={() => setEditor(item)}
                            >
                              Editar
                            </button>
                          ) : (
                            <button
                              className="cat-save"
                              disabled={busy || savedLoading || !!savedError}
                              aria-pressed={!!saved[item.id]}
                              onClick={() =>
                                saved[item.id]
                                  ? setSelected(item.id)
                                  : save(item)
                              }
                            >
                              {saved[item.id] ? "✓ Salva" : "+ Salvar"}
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                  {list.length === 0 && (
                    <div className="cat-empty">
                      <span aria-hidden="true">↗</span>
                      <h3>
                        {tab === "saved"
                          ? "Seu próximo passo ainda está por aqui."
                          : tab === "admin"
                            ? "Cadastre a primeira oportunidade."
                            : "Nenhuma oportunidade por enquanto."}
                      </h3>
                      <p>
                        {tab === "saved"
                          ? "Salve uma oportunidade em Explorar para organizar sua inscrição."
                          : tab === "admin"
                            ? "Use uma fonte oficial e revise os requisitos antes de publicar."
                            : "Tente ajustar os filtros. As oportunidades aparecerão assim que forem cadastradas e publicadas."}
                      </p>
                      {tab === "saved" && (
                        <button
                          className="cat-solid"
                          onClick={() => setTab("explore")}
                        >
                          Explorar oportunidades
                        </button>
                      )}
                    </div>
                  )}
                </>
              )
            )}
            {tab === "saved" &&
              !loading &&
              !savedLoading &&
              !loadError &&
              missingSaved.map((id) => (
                <div className="cat-unavailable" key={id}>
                  <div>
                    <strong>Oportunidade retirada de publicação</strong>
                    <p>
                      Seu acompanhamento foi preservado, mas os detalhes não
                      estão disponíveis.
                    </p>
                  </div>
                  <button
                    disabled={busy || !!savedError}
                    className="cat-link"
                    onClick={() => remove(id)}
                  >
                    Remover
                  </button>
                </div>
              ))}
          </>
        )}
      </main>
      <footer>
        <span>Oportunidades UFOP · Projeto estudantil independente</span>
        <span>Inscrições são feitas nos canais oficiais.</span>
      </footer>
    </div>
  );
}
