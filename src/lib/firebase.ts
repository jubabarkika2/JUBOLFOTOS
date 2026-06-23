/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User, 
  signOut 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Adiciona o escopo de leitura do Gmail
provider.addScope('https://www.googleapis.com/auth/gmail.readonly');

let isSigningIn = false;

// Chave para armazenar o token provisoriamente
const TOKEN_STORAGE_KEY = 'gmail_gallery_access_token';

export const saveToken = (token: string) => {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
};

export const getAccessToken = (): string | null => {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
};

export const clearToken = () => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
};

// Tenta restaurar a sessão se o token estivesse guardado em memória por alguma re-renderização, 
// ou escuta mudanças de estado do usuário.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // 1. Processa o resultado do redirecionamento se o usuário acabou de voltar do login no celular
  getRedirectResult(auth)
    .then((result) => {
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          saveToken(credential.accessToken);
          if (result.user && onAuthSuccess) {
            onAuthSuccess(result.user, credential.accessToken);
          }
        }
      }
    })
    .catch((error) => {
      console.error('Erro ao processar resultado do redirecionamento:', error);
    });

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const token = getAccessToken();
      if (token) {
        if (onAuthSuccess) onAuthSuccess(user, token);
      } else {
        // Se houver usuário mas o token expirou ou sumiu, remove
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      clearToken();
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Opção 1: Popup (Melhor para desktop)
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    if (!credential?.accessToken) {
      throw new Error('Não foi possível obter o token de acesso do Google OAuth.');
    }

    saveToken(credential.accessToken);
    return { user: result.user, accessToken: credential.accessToken };
  } catch (error: any) {
    console.error('Erro ao fazer login via popup:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Opção 2: Redirecionamento (Melhor para celular/mobile browsers)
export const googleSignInRedirect = async (): Promise<void> => {
  try {
    isSigningIn = true;
    await signInWithRedirect(auth, provider);
  } catch (error: any) {
    console.error('Erro ao iniciar redirecionamento:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const logout = async (): Promise<void> => {
  await signOut(auth);
  clearToken();
};

