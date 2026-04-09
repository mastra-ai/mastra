import { login, clearCredentials } from './credentials.js';

export async function loginAction() {
  await login();
}

export async function logoutAction() {
  await clearCredentials();
  console.info('\nLogged out. Credentials removed.\n');
  if (process.env.MASTRA_API_TOKEN) {
    console.warn('   Note: MASTRA_API_TOKEN is still set in your environment.\n   Unset it to fully log out.\n');
  }
}
