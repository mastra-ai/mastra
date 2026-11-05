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
        'To authenticate agents, CI, and other headless shells, either:\n' +
        '  - Run `mastra auth login` in your own terminal. Later commands here reuse that session.\n' +
        "  - Or create an API token (`mastra auth tokens create <NAME>` where you're signed in, or in the dashboard),\n" +
        '    then set MASTRA_API_TOKEN and MASTRA_ORG_ID in this environment.\n',
    );
  }
  try {
    await login();
  } catch (error) {
    if (!(error instanceof LoginCancelledError)) throw error;
    if (!interactive) {
      throw new Error(
        "Browser sign-in did not complete in a non-interactive terminal. Run `mastra auth login` in your own terminal, or set MASTRA_API_TOKEN and MASTRA_ORG_ID (create a token with `mastra auth tokens create <NAME>` where you're signed in, or in the dashboard).",
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
