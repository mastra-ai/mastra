// Adapted from Circle's agent-stack-starter-kits.
// Copyright 2026 Circle Internet Group, Inc.
// SPDX-License-Identifier: Apache-2.0

import { CircleCliError, runCircle } from './cli';

// Login is absent by design: it is an interactive email + OTP exchange, and an agent must never
// accept the Terms of Use for a user. This only verifies the session and says what to run.

export const TERMS_MESSAGE =
  'Circle Terms of Use are not accepted on this host. An agent must never accept the Terms ' +
  'on your behalf, so this template will not do it for you. Run:\n\n' +
  '  circle wallet status\n\n' +
  'yourself, review and accept the Terms of Use when prompted, then retry.';

export const LOGIN_MESSAGE =
  'No valid Circle agent session. Run:\n\n' +
  '  circle wallet login\n\n' +
  'in your own terminal, complete the email OTP, then retry.';

function rawText(e: unknown): string {
  if (e instanceof CircleCliError) {
    return [e.message, e.stdout, e.stderr].filter(Boolean).join('\n');
  }
  return e instanceof Error ? e.message : String(e);
}

// `circle wallet status` exits non-zero when logged out, so capture the output either way.
async function statusText(): Promise<string> {
  try {
    return await runCircle(['wallet', 'status', '--type', 'agent', '--output', 'json']);
  } catch (e) {
    return rawText(e);
  }
}

// The CLI's readable output shows testnet first, so scanning it misses a valid mainnet session
// when testnet has expired. The JSON output lists both.
function isLoggedIn(status: string): boolean {
  try {
    const raw = JSON.parse(status) as {
      data?: { testnet?: { tokenStatus?: string }; mainnet?: { tokenStatus?: string } };
      testnet?: { tokenStatus?: string };
      mainnet?: { tokenStatus?: string };
    };
    const d = raw.data ?? raw;
    return /valid/i.test(d.testnet?.tokenStatus ?? '') || /valid/i.test(d.mainnet?.tokenStatus ?? '');
  } catch {
    return /status:\s*valid/i.test(status);
  }
}

function termsPending(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('terms') && (lower.includes('accept') || lower.includes('required'));
}

export async function sessionStatus(): Promise<{ loggedIn: boolean; termsPending: boolean; raw: string }> {
  const raw = await statusText();
  return { loggedIn: isLoggedIn(raw), termsPending: termsPending(raw), raw };
}

export async function requireSession(): Promise<void> {
  const { loggedIn, termsPending: pending } = await sessionStatus();
  if (loggedIn) return;
  throw new Error(pending ? TERMS_MESSAGE : LOGIN_MESSAGE);
}

// Safe for an agent in a way logging in is not: it destroys credentials rather than creating them.
export async function logout(): Promise<{ loggedOut: boolean; message: string }> {
  if (!(await sessionStatus()).loggedIn) {
    return { loggedOut: false, message: 'No active Circle session; nothing to log out of.' };
  }
  await runCircle(['wallet', 'logout', '--type', 'agent']);
  return { loggedOut: true, message: 'Logged out; the Circle session has been cleared.' };
}
