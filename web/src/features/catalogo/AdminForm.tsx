import { useState } from "react";
import type { FormEvent } from "react";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { COURSES, AREAS, TYPES, toggle } from "../../lib/profile";
import {
  CAMPUSES,
  MODALITIES,
  deadlineInput,
  parseDeadline,
  safeUrl,
} from "../../lib/opportunities";
import type { Opportunity } from "../../lib/opportunities";

type Props = {
  uid: string;
  item: Opportunity | null;
  onDone: () => void;
  onCancel: () => void;
};
export default function AdminForm({ uid, item, onDone, onCancel }: Props) {
  const [form, setForm] = useState({
    title: item?.title ?? "",
    organization: item?.organization ?? "",
    description: item?.description ?? "",
    requirements: item?.requirements ?? "",
    category: item?.category ?? "",
    courses: item?.courses ?? [],
    areas: item?.areas ?? [],
    campus: item?.campus ?? "João Monlevade",
    modality: item?.modality ?? "Presencial",
    remuneration: item?.remuneration ?? "",
    sourceUrl: item?.sourceUrl ?? "",
    applicationUrl: item?.applicationUrl ?? "",
    deadline: item ? deadlineInput(item.deadline) : "",
    documents: item?.documents.join("\n") ?? "",
    status: item?.status ?? "rascunho",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const field = (key: keyof typeof form, value: string) =>
    setForm({ ...form, [key]: value });
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    const deadline = parseDeadline(form.deadline);
    const documents = [
      ...new Set(
        form.documents
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean),
      ),
    ];
    if (
      !safeUrl(form.sourceUrl) ||
      (form.applicationUrl && !safeUrl(form.applicationUrl))
    ) {
      setError("Informe links completos começando com https:// ou http://.");
      return;
    }
    if (!Number.isFinite(deadline.getTime())) {
      setError("Informe um prazo válido.");
      return;
    }
    if (form.status === "publicada" && deadline.getTime() <= Date.now()) {
      setError(
        "Para publicar, o prazo deve estar no futuro. Use “Encerrada” para registrar uma oportunidade antiga.",
      );
      return;
    }
    if (documents.length > 15 || documents.some((v) => v.length > 150)) {
      setError("Use até 15 documentos, com no máximo 150 caracteres cada.");
      return;
    }
    if (
      form.title.trim().length < 5 ||
      !form.organization.trim() ||
      form.description.trim().length < 20 ||
      !form.requirements.trim()
    ) {
      setError("Preencha título, organização, descrição e requisitos.");
      return;
    }
    setBusy(true);
    try {
      const data = {
        ...form,
        title: form.title.trim(),
        organization: form.organization.trim(),
        description: form.description.trim(),
        requirements: form.requirements.trim(),
        remuneration: form.remuneration.trim(),
        sourceUrl: safeUrl(form.sourceUrl),
        applicationUrl: form.applicationUrl ? safeUrl(form.applicationUrl) : "",
        deadline: Timestamp.fromDate(deadline),
        documents,
        updatedAt: serverTimestamp(),
      };
      if (item) await updateDoc(doc(db!, "oportunidades", item.id), data);
      else
        await addDoc(collection(db!, "oportunidades"), {
          ...data,
          createdBy: uid,
          createdAt: serverTimestamp(),
        });
      onDone();
    } catch {
      setError(
        "Não foi possível salvar. Confira sua conexão, a permissão administrativa e as novas regras do Firestore.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="cat-editor">
      <p className="eyebrow">ADMINISTRAÇÃO</p>
      <h2>{item ? "Editar oportunidade" : "Uma nova porta se abre."}</h2>
      <p className="muted">
        Transcreva as informações da fonte oficial e revise antes de publicar.
      </p>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <form onSubmit={save}>
        <fieldset disabled={busy}>
          <div className="cat-form-grid">
            <label>
              Título
              <input
                required
                minLength={5}
                maxLength={160}
                value={form.title}
                onChange={(e) => field("title", e.target.value)}
                placeholder="Ex.: Bolsa de pesquisa em inteligência artificial"
              />
            </label>
            <label>
              Organização responsável
              <input
                required
                maxLength={120}
                value={form.organization}
                onChange={(e) => field("organization", e.target.value)}
                placeholder="Departamento, laboratório ou empresa"
              />
            </label>
            <label>
              Tipo de oportunidade
              <select
                required
                value={form.category}
                onChange={(e) => field("category", e.target.value)}
              >
                <option value="" disabled>
                  Selecione
                </option>
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Campus
              <select
                value={form.campus}
                onChange={(e) => field("campus", e.target.value)}
              >
                {CAMPUSES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Modalidade
              <select
                value={form.modality}
                onChange={(e) => field("modality", e.target.value)}
              >
                {MODALITIES.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label>
              Bolsa ou remuneração
              <input
                maxLength={120}
                value={form.remuneration}
                onChange={(e) => field("remuneration", e.target.value)}
                placeholder="Ex.: R$ 700/mês ou não informado"
              />
            </label>
            <label>
              Prazo de inscrição · horário de Brasília
              <input
                required
                type="datetime-local"
                value={form.deadline}
                onChange={(e) => field("deadline", e.target.value)}
              />
            </label>
            <label>
              Situação
              <select
                value={form.status}
                onChange={(e) => field("status", e.target.value)}
              >
                <option value="rascunho">
                  Rascunho · visível só para administradores
                </option>
                <option value="publicada">Publicada</option>
                <option value="encerrada">Encerrada</option>
              </select>
            </label>
          </div>
          <label>
            Descrição
            <textarea
              required
              minLength={20}
              maxLength={6000}
              rows={5}
              value={form.description}
              onChange={(e) => field("description", e.target.value)}
            />
          </label>
          <label>
            Requisitos completos
            <textarea
              required
              maxLength={4000}
              rows={4}
              value={form.requirements}
              onChange={(e) => field("requirements", e.target.value)}
              placeholder="Período mínimo, conhecimentos, disponibilidade e demais condições."
            />
          </label>
          <fieldset className="cat-options">
            <legend>Cursos aceitos · nenhum selecionado significa todos</legend>
            {COURSES.map((c) => (
              <label key={c}>
                <input
                  type="checkbox"
                  checked={form.courses.includes(c)}
                  onChange={() =>
                    setForm({ ...form, courses: toggle(form.courses, c) })
                  }
                />
                {c}
              </label>
            ))}
          </fieldset>
          <fieldset className="cat-options">
            <legend>
              Áreas relacionadas · nenhuma selecionada significa geral
            </legend>
            {AREAS.map((a) => (
              <label key={a}>
                <input
                  type="checkbox"
                  checked={form.areas.includes(a)}
                  onChange={() =>
                    setForm({ ...form, areas: toggle(form.areas, a) })
                  }
                />
                {a}
              </label>
            ))}
          </fieldset>
          <label>
            Documentos necessários · um por linha
            <textarea
              maxLength={2300}
              rows={4}
              value={form.documents}
              onChange={(e) => field("documents", e.target.value)}
              placeholder={
                "Comprovante de matrícula\nHistórico escolar\nCurrículo"
              }
            />
          </label>
          <div className="cat-form-grid">
            <label>
              Link da fonte oficial ou edital
              <input
                required
                type="url"
                maxLength={2000}
                value={form.sourceUrl}
                onChange={(e) => field("sourceUrl", e.target.value)}
                placeholder="https://"
              />
            </label>
            <label>
              Link de inscrição · opcional
              <input
                type="url"
                maxLength={2000}
                value={form.applicationUrl}
                onChange={(e) => field("applicationUrl", e.target.value)}
                placeholder="https://"
              />
            </label>
          </div>
          <div className="actions">
            <button type="button" className="secondary" onClick={onCancel}>
              Cancelar
            </button>
            <button className="primary">
              {busy
                ? "Salvando…"
                : form.status === "publicada"
                  ? "Salvar e publicar"
                  : "Salvar oportunidade"}
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
