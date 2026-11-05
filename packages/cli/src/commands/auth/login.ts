import {
  login,
  clearCredentials,
  loadCredentials,
  verifyToken,
  tryRefreshToken,
  isInteractive,
  LoginCancelledError,
} from './credentials.js';

export async function loginAction() {
  const existing = await loadCredentials();
  if (existing) {
    const stillValid = (await verifyToken(existing.token)) || Boolean(await tryRefreshToken(existing));
    if (stillValid) {
      console.info(`\nAlready logged in as ${existing.user.email}\n`);
      return;
    }
  }
  const interactive = isInteractive();
  if (!interactive) {
    console.warn(
      '\nNo interactive terminal detected, so browser sign-in may not finish here.\n' +
        'For agents, CI, and other headless shells, use an API token instead:\n' +
        '  1. In an interactive terminal, run: mastra auth tokens create <NAME>\n' +
        '  2. Set the printed token as MASTRA_API_TOKEN in this environment.\n',
    );
  }
  try {
    await login();
  } catch (error) {
    if (!(error instanceof LoginCancelledError)) throw error;
    if (!interactive) {
      throw new Error(
        'Browser sign-in did not complete in a non-interactive terminal. Set MASTRA_API_TOKEN instead (create one in an interactive terminal with: mastra auth tokens create <NAME>).',
      );
    }
    console.info('\nLogin cancelled.\n');
  }
}

export async function logoutAction() {
  await clearCredentials();
  console.info('\nLogged out. Credentials removed.\n');
  if (process.env.MASTRA_API_TOKEN) {
    console.warn('   Note: MASTRA_API_TOKEN is still set in your environment.\n   Unset it to fully log out.\n');
  }
}
