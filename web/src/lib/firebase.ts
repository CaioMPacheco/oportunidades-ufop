import { initializeApp } from "firebase/app";
import {
  getAuth,
  browserSessionPersistence,
  setPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const configured = Object.values(config).every(
  (value) => typeof value === "string" && value.trim(),
);
const app = configured ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
// Sessão limitada à aba: não implementamos armazenamento próprio de senhas/tokens.
export const authReady = auth
  ? setPersistence(auth, browserSessionPersistence)
  : Promise.resolve();
if (auth) auth.languageCode = "pt-BR";
