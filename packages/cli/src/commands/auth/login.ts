import {
  login,
  clearCredentials,
  loadCredentials,
  verifyToken,
  tryRefreshToken,
  getCurrentOrgId,
  isInteractive,
  LoginCancelledError,
} from './credentials.js';

export async function loginAction() {
  const interactive = isInteractive();
  const envToken = process.env.MASTRA_API_TOKEN;
  // Checked before saved credentials because getToken() prefers MASTRA_API_TOKEN.
  if (!interactive && envToken) {
    if (!(await verifyToken(envToken))) {
      throw new Error(
        "MASTRA_API_TOKEN is set but could not be verified (the token is invalid or revoked, or the Mastra platform is unreachable). Create a new token with `mastra auth tokens create <NAME>` where you're signed in, or in the dashboard.",
      );
    }
    const orgId = await getCurrentOrgId();
    if (!orgId) {
      throw new Error(
        'MASTRA_API_TOKEN is valid, but no organization is selected. Set MASTRA_ORG_ID to the token’s organization ID.',
      );
    }
    console.info(`\nAuthenticated via MASTRA_API_TOKEN (org ${orgId}). Browser sign-in is not needed.\n`);
    return;
  }
  const existing = await loadCredentials();
  if (existing) {
    const stillValid = (await verifyToken(existing.token)) || Boolean(await tryRefreshToken(existing));
    if (stillValid) {
      console.info(`\nAlready logged in as ${existing.user.email}\n`);
      return;
    }
  }
  if (!interactive) {
    console.warn(
      '\nNo interactive terminal detected, so browser sign-in may not finish here.\n' +
        'To authenticate agents, CI, and other headless shells, either:\n' +
        '  - On this machine, run `mastra auth login` in your own terminal. Later commands here reuse that session.\n' +
        "  - Elsewhere (CI, other machines), create an API token (`mastra auth tokens create <NAME>` where you're signed in, or in the dashboard),\n" +
        '    then set MASTRA_API_TOKEN and MASTRA_ORG_ID in this environment.\n',
    );
  }
  try {
    await login();
  } catch (error) {
    if (!(error instanceof LoginCancelledError)) throw error;
    if (!interactive) {
      throw new Error(
        "Browser sign-in did not complete in a non-interactive terminal. On this machine, run `mastra auth login` in your own terminal; elsewhere (CI, other machines), set MASTRA_API_TOKEN and MASTRA_ORG_ID (create a token with `mastra auth tokens create <NAME>` where you're signed in, or in the dashboard).",
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
