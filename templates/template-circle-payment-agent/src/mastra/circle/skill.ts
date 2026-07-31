// Adapted from Circle's agent-stack-starter-kits.
// Copyright 2026 Circle Internet Group, Inc.
// SPDX-License-Identifier: Apache-2.0

// The agent ships no playbook of its own: everything it is told to do comes from the markdown at
// agents.circle.com/skills, fetched at runtime, so publishing a change there needs no code release.

export const SKILLS_BASE_URL = 'https://agents.circle.com/skills';
export const SETUP_SKILL_URL = `${SKILLS_BASE_URL}/setup.md`;

export const SUB_SKILLS = {
  'wallet-login': `${SKILLS_BASE_URL}/wallet-login.md`,
  'wallet-fund': `${SKILLS_BASE_URL}/wallet-fund.md`,
  'wallet-pay': `${SKILLS_BASE_URL}/wallet-pay.md`,
  'discover-services': `${SKILLS_BASE_URL}/discover-services.md`,
} as const satisfies Record<string, string>;

export type SubSkillName = keyof typeof SUB_SKILLS;

export const SUB_SKILL_NAMES = Object.keys(SUB_SKILLS) as SubSkillName[];

export const SUB_SKILL_CATALOG = SUB_SKILL_NAMES.map(n => `- ${n} → ${SUB_SKILLS[n]}`).join('\n');

// Every fetched skill stays in history for the session, so an uncapped fetch can push a
// token-per-minute limit into 429s. Sized so setup.md, whose tail carries the rules, arrives whole.
export const MAX_SKILL_CHARS = 16_000;

function cap(body: string, url: string): string {
  if (body.length <= MAX_SKILL_CHARS) return body;
  const omitted = body.length - MAX_SKILL_CHARS;
  return `${body.slice(0, MAX_SKILL_CHARS)}\n\n[...${omitted} chars omitted. The full document is at ${url}]`;
}

async function fetchMarkdown(url: string): Promise<string> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(
      `Failed to fetch ${url}: ${res.status} ${res.statusText}. ` +
        'Check connectivity or visit the URL in a browser to confirm it is reachable.',
    );
  }
  return cap(await res.text(), url);
}

export function fetchSetupSkill(): Promise<string> {
  return fetchMarkdown(SETUP_SKILL_URL);
}

export function fetchSubSkill(name: SubSkillName): Promise<string> {
  return fetchMarkdown(SUB_SKILLS[name]);
}
