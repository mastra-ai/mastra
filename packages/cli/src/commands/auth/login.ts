import { login, clearCredentials } from './credentials.js';

export async function loginAction() {
  await login();
}

export async function logoutAction() {
  await clearCredentials();
  console.info('\nLogged out. Credentials removed.\n');
}
