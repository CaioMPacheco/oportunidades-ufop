export const COURSES = [
  "Engenharia de Produção",
  "Engenharia Elétrica",
  "Inteligência Artificial (IA)",
  "Engenharia da Computação",
  "Sistemas de Informação",
] as const;
export const AREAS = [
  "Desenvolvimento de software",
  "Inteligência artificial e dados",
  "Automação e robótica",
  "Energia e eletrônica",
  "Gestão e processos",
  "Pesquisa e inovação",
  "Educação e impacto social",
] as const;
export const TYPES = [
  "Estágios",
  "Bolsas",
  "Iniciação científica",
  "Extensão",
  "Monitorias",
] as const;
export const TYPE_DETAILS = [
  "Experiência profissional e novos desafios.",
  "Apoio financeiro à sua trajetória.",
  "Investigue perguntas e produza conhecimento.",
  "Conecte a universidade à comunidade.",
  "Aprenda mais ajudando outros estudantes.",
];
export type Profile = {
  name: string;
  email: string;
  course: string;
  areas: string[];
  types: string[];
  emailNotifications: boolean;
  frequency: "semanal" | "diaria";
  onboarded: boolean;
};
export const emptyProfile: Profile = {
  name: "",
  email: "",
  course: "",
  areas: [],
  types: [],
  emailNotifications: false,
  frequency: "semanal",
  onboarded: false,
};
export function toggle(items: string[], value: string) {
  return items.includes(value)
    ? items.filter((item) => item !== value)
    : [...items, value];
}
export function validPassword(password: string) {
  return (
    password.length >= 12 &&
    password.length <= 128 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^a-zA-Z0-9]/.test(password)
  );
}
export function validProfile(profile: Profile) {
  return (
    profile.name.trim().length >= 2 &&
    profile.name.trim().length <= 100 &&
    (COURSES as readonly string[]).includes(profile.course) &&
    profile.areas.length > 0 &&
    profile.areas.every((value) =>
      (AREAS as readonly string[]).includes(value),
    ) &&
    profile.types.length > 0 &&
    profile.types.every((value) => (TYPES as readonly string[]).includes(value))
  );
}
