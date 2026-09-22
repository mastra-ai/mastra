import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { initialMessageOptions, takeInitialPrompt } from '../../src/initial-prompt.js';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

const PROMPT = 'Return the Mastra Code initial prompt phrase.';

export const initialPromptScenario: McE2eScenario = {
  name: 'initial-prompt',
  description: 'Start the interactive TUI with --initial-prompt and assert the prompt is sent without typing.',
  testName: 'sends the --initial-prompt text as the first message and stays interactive',
  useOpenAIModel: true,
  aimockFixture: 'initial-prompt.json',
  async inProcessApp({ startMastraCodeApp }) {
    // The same argv handling main.ts runs before starting the TUI.
    const args = takeInitialPrompt(['node', 'mastracode', '--initial-prompt', PROMPT], {});
    assert.deepEqual(args.argv, ['node', 'mastracode']);
    return startMastraCodeApp({ tui: initialMessageOptions(args, null) });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })).toBeVisible();

    await runtime.waitForScreenText(/Return the Mastra Code initial prompt phrase\./, terminal);
    await runtime.waitForScreenText(/MC initial prompt response/, terminal);
    runtime.printScreen('after initial prompt', terminal);
    await terminal.flushInput?.();
    if (!terminal.serializeHistory) throw new Error('Render-count assertions require full terminal scrollback');
    const transcript = terminal.serializeHistory().output;
    assert.equal(transcript.split(PROMPT).length - 1, 1, `the initial prompt renders exactly once:\n${transcript}`);

    // The session stays interactive after the initial prompt.
    terminal.submit('/help');
    await runtime.waitForScreenText(/Commands/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const chat = requests.filter(request => !JSON.stringify(request).includes('generate a short title'));
    assert.equal(chat.length, 1, 'expected exactly one chat request');
    const body = JSON.stringify(chat[0]);
    assert.ok(body.includes(PROMPT), 'the chat request carries the initial prompt');
    assert.ok(!body.includes('piped via stdin'), 'the initial prompt is sent without the piped-stdin preamble');
  },
};

const SKILL_NAME = 'initial-prompt-skill-e2e';
const SKILL_INSTRUCTIONS = 'Initial prompt skill instructions.';
const SKILL_ARGS = 'https://github.com/mastra-ai/mastra/pull/1';

export const initialPromptSkillScenario: McE2eScenario = {
  name: 'initial-prompt-skill',
  description: 'Start the interactive TUI with --initial-prompt set to /skill/<name> and assert the skill activates.',
  testName: 'runs a /skill command passed as the --initial-prompt',
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'initial-prompt-skill.json',
  prepare({ projectDir }) {
    const dir = join(projectDir, '.mastracode', 'skills', SKILL_NAME);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'SKILL.md'),
      `---\nname: ${SKILL_NAME}\ndescription: ${SKILL_NAME} description\nuser-invocable: true\n---\n${SKILL_INSTRUCTIONS}\n`,
    );
  },
  async inProcessApp({ startMastraCodeApp }) {
    const args = takeInitialPrompt(
      ['node', 'mastracode', '--initial-prompt', `/skill/${SKILL_NAME} ${SKILL_ARGS}`],
      {},
    );
    return startMastraCodeApp({ tui: initialMessageOptions(args, null) });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/MC initial prompt skill response/, terminal, 15_000);
    runtime.printScreen('after initial skill prompt', terminal);
    terminal.submit('/help');
    await runtime.waitForScreenText(/Commands/i, terminal, 8_000);
    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const chat = requests.filter(request => !JSON.stringify(request).includes('generate a short title'));
    assert.equal(chat.length, 1, 'expected exactly one chat request');
    const body = JSON.stringify(chat[0]);
    assert.ok(body.includes(SKILL_INSTRUCTIONS), 'the skill instructions reach the model');
    assert.ok(body.includes(`ARGUMENTS: ${SKILL_ARGS}`), 'the skill arguments reach the model');
  },
};

const RESUME_RESOURCE_ID = 'mc-e2e-initial-prompt-resume-resource';
const RESUME_PROMPT = 'Return the Mastra Code resumed prompt phrase.';
const SEEDED_REPLY = 'Seeded initial prompt resume assistant turn.';
const FOLLOW_UP = 'Typed follow-up after resuming.';

const quoteSql = (value: string) => `'${value.replaceAll("'", "''")}'`;

/** One earlier conversation for the project directory, which startup resumes. */
function seedConversation(dbPath: string, projectDir: string) {
  const threadId = 'thread-mc-e2e-initial-prompt-resume';
  const now = new Date('2026-09-01T12:00:00.000Z');
  const later = new Date(now.getTime() + 1000);
  const text = (t: string) => quoteSql(JSON.stringify({ format: 2, parts: [{ type: 'text', text: t }] }));
  const sql = `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${quoteSql(threadId)}, ${quoteSql(RESUME_RESOURCE_ID)}, 'E2E earlier conversation', ${quoteSql(JSON.stringify({ projectPath: projectDir }))}, ${quoteSql(now.toISOString())}, ${quoteSql(later.toISOString())});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values
  ('msg-mc-e2e-initial-prompt-resume-user', ${quoteSql(threadId)}, ${text('Seeded earlier user turn.')}, 'user', 'v2', ${quoteSql(now.toISOString())}, ${quoteSql(RESUME_RESOURCE_ID)}),
  ('msg-mc-e2e-initial-prompt-resume-assistant', ${quoteSql(threadId)}, ${text(SEEDED_REPLY)}, 'assistant', 'v2', ${quoteSql(later.toISOString())}, ${quoteSql(RESUME_RESOURCE_ID)});
`;
  execFileSync('sqlite3', [dbPath], { input: sql });
}

function resumeScenario(
  flag: '--initial-prompt' | '--send-prompt',
): Pick<McE2eScenario, 'projectFixture' | 'useOpenAIModel' | 'aimockFixture' | 'env' | 'prepare' | 'inProcessApp'> {
  return {
    projectFixture: 'long-branch',
    useOpenAIModel: true,
    aimockFixture: 'initial-prompt-resume.json',
    env: () => ({ MASTRA_RESOURCE_ID: RESUME_RESOURCE_ID }),
    prepare: ({ dbPath, projectDir }) => seedConversation(dbPath, projectDir),
    async inProcessApp({ startMastraCodeApp }) {
      const args = takeInitialPrompt(['node', 'mastracode', flag, RESUME_PROMPT], {});
      return startMastraCodeApp({ tui: initialMessageOptions(args, null) });
    },
  };
}

export const initialPromptResumeScenario: McE2eScenario = {
  name: 'initial-prompt-resume',
  description: 'With --initial-prompt, a resumed conversation is shown without sending the prompt into it.',
  testName: 'does not send --initial-prompt into a resumed conversation',
  ...resumeScenario('--initial-prompt'),
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Seeded initial prompt resume assistant turn/, terminal, 15_000);
    await runtime.waitForScreenText(/initial prompt was not sent\. Use --send-prompt/, terminal, 8_000);
    runtime.printScreen('after resume', terminal);
    await runtime.waitForScreenTextAbsent(/Return the Mastra Code resumed prompt phrase/, terminal, 2_000);

    // The conversation carries on normally, still without the skipped prompt.
    terminal.submit(FOLLOW_UP);
    await runtime.waitForScreenText(/MC resumed prompt response/, terminal, 15_000);
    terminal.submit('/help');
    await runtime.waitForScreenText(/Commands/i, terminal, 8_000);
    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const body = JSON.stringify(requests);
    assert.ok(body.includes(FOLLOW_UP), 'the typed follow-up is sent');
    assert.ok(!body.includes(RESUME_PROMPT), 'the skipped initial prompt never reaches the model');
  },
};

export const sendPromptResumeScenario: McE2eScenario = {
  name: 'send-prompt-resume',
  description: 'With --send-prompt, the prompt is sent into the resumed conversation.',
  testName: 'sends --send-prompt into a resumed conversation',
  ...resumeScenario('--send-prompt'),
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Seeded initial prompt resume assistant turn/, terminal, 15_000);
    await runtime.waitForScreenText(/MC resumed prompt response/, terminal, 15_000);
    runtime.printScreen('after send-prompt', terminal);
    terminal.submit('/help');
    await runtime.waitForScreenText(/Commands/i, terminal, 8_000);
    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const chat = requests.filter(request => !JSON.stringify(request).includes('generate a short title'));
    assert.equal(chat.length, 1, 'expected exactly one chat request');
    const body = JSON.stringify(chat[0]);
    assert.ok(body.includes(RESUME_PROMPT), 'the prompt is sent');
    assert.ok(body.includes(SEEDED_REPLY), 'into the resumed conversation');
  },
};
