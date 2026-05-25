import { login, clearCredentials, loadCredentials, verifyToken, tryRefreshToken } from './credentials.js';

export async function loginAction() {
  const existing = await loadCredentials();
  if (existing) {
    const stillValid = (await verifyToken(existing.token)) || Boolean(await tryRefreshToken(existing));
    if (stillValid) {
      console.info(`\nAlready logged in as ${existing.user.email}\n`);
      return;
    }
  }
  await login();
}

export async function logoutAction() {
  await clearCredentials();
  console.info('\nLogged out. Credentials removed.\n');
  if (process.env.MASTRA_API_TOKEN) {
    console.warn('   Note: MASTRA_API_TOKEN is still set in your environment.\n   Unset it to fully log out.\n');
  }
}
