import type { Profile } from "./profile";

export const CAMPUSES = [
  "João Monlevade",
  "Ouro Preto",
  "Mariana",
  "Todos os campi",
] as const;
export const MODALITIES = ["Presencial", "Híbrido", "Remoto"] as const;
export const TRACKING_STATES = [
  "Tenho interesse",
  "Preparando documentos",
  "Inscrição realizada",
  "Desisti",
] as const;
export type Opportunity = {
  id: string;
  title: string;
  organization: string;
  description: string;
  requirements: string;
  category: string;
  courses: string[];
  areas: string[];
  campus: string;
  modality: string;
  remuneration: string;
  sourceUrl: string;
  applicationUrl: string;
  deadline: { toMillis(): number };
  documents: string[];
  status: "rascunho" | "publicada" | "encerrada";
  createdBy: string;
};
export type Tracking = { status: string; checkedDocuments: string[] };
export const initialTracking: Tracking = {
  status: "Tenho interesse",
  checkedDocuments: [],
};
export function isOpen(opportunity: Opportunity, now = Date.now()) {
  return (
    opportunity.status === "publicada" && opportunity.deadline.toMillis() > now
  );
}
export function matchesProfile(opportunity: Opportunity, profile: Profile) {
  return (
    (opportunity.courses.length === 0 ||
      opportunity.courses.includes(profile.course)) &&
    profile.types.includes(opportunity.category) &&
    (opportunity.areas.length === 0 ||
      opportunity.areas.some((area) => profile.areas.includes(area)))
  );
}
export function safeUrl(value: string) {
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
export function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}
export function formatDeadline(value: { toMillis(): number }) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(value.toMillis());
}
// Entrada administrativa e exibição usam sempre o horário de Brasília (UTC-03).
export function parseDeadline(value: string) {
  return new Date(`${value}:00-03:00`);
}
export function deadlineInput(value: { toMillis(): number }) {
  return new Date(value.toMillis() - 3 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);
}
export function cleanChecklist(checked: string[], allowed: string[]) {
  return [...new Set(checked)].filter((item) => allowed.includes(item));
}
