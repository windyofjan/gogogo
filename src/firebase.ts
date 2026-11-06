import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAwA7RS-9K64L3tTTuBYdYhj_74FI_Zyzs",
  authDomain: "gen-lang-client-0902798343.firebaseapp.com",
  projectId: "gen-lang-client-0902798343",
  storageBucket: "gen-lang-client-0902798343.firebasestorage.app",
  messagingSenderId: "881156748423",
  appId: "1:881156748423:web:a5f17155574cba1e9d3422"
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with the custom databaseId provided by the platform
export const db = getFirestore(app, "ai-studio-f36382e3-3042-4faa-9ce4-9610a295cd7f");
