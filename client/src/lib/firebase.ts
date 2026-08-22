import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

export const firebaseConfig = {
  apiKey: "AIzaSyDYeUeOUYmOEmACUp-y41Q257QujPFJ5M0",
  authDomain: "igraemkz-45cdc.firebaseapp.com",
  projectId: "igraemkz-45cdc",
  storageBucket: "igraemkz-45cdc.firebasestorage.app",
  messagingSenderId: "222617026836",
  appId: "1:222617026836:web:9bce0658da19cdff844201"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
