import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyCUPVBb36YZayxp85qkpdZCRVXvMQJMf8g",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "nick-9dbb0.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "nick-9dbb0",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "nick-9dbb0.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "444204613118",
  appId: env.VITE_FIREBASE_APP_ID || "1:444204613118:web:d8fba6f021446bf16154af",
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || "G-0YV6TCYDM2",
};

const app = getApps().length > 0
  ? getApp()
  : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const authPersistenceReady = setPersistence(auth, browserLocalPersistence);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
