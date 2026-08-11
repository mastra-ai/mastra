import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { detectProject } from '@mastra/code-sdk/utils/project';
import type { McE2eScenario } from './types.js';

const OLD_RESOURCE_ID = 'mc-e2e-old-dirname-resource';
const THREAD_ID = 'thread-resource-drift-prompt-accept';
const TITLE = 'Thread from before resource drift';
const USER_MESSAGE_ID = 'msg-drift-accept-user';
const ASSISTANT_MESSAGE_ID = 'msg-drift-accept-assistant';
const SOURCE_OBSERVATIONS = 'Observed that the source thread retains important project context.';
const SOURCE_GENERATION = 7;
const SOURCE_ORIGIN = 'reflection';
const SOURCE_LAST_OBSERVED_AT = '2099-01-01T00:00:02.000Z';
const SOURCE_OBSERVED_MESSAGE_IDS = [USER_MESSAGE_ID, ASSISTANT_MESSAGE_ID];

let scenarioDbPath = '';
let currentResourceId = '';

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function gitInDir(args: string[], cwd: string): void {
  execFileSync('git', args, { cwd, stdio: 'pipe' });
}

function seedProject(projectDir: string): void {
  mkdirSync(projectDir, { recursive: true });
  gitInDir(['init', '-b', 'main'], projectDir);
  gitInDir(['config', 'user.email', 'mc-e2e@example.com'], projectDir);
  gitInDir(['config', 'user.name', 'MC E2E'], projectDir);
  execFileSync('touch', [join(projectDir, '.gitkeep')]);
  gitInDir(['add', '.gitkeep'], projectDir);
  gitInDir(['commit', '-m', 'init'], projectDir);
  gitInDir(['remote', 'add', 'origin', 'https://github.com/test-org/my-project.git'], projectDir);
}

function seedDriftThread(dbPath: string, projectDir: string): void {
  const now = new Date('2099-01-01T00:00:00.000Z');
  const metadata = JSON.stringify({ projectPath: projectDir });
  const userContent = JSON.stringify({
    format: 2,
    parts: [{ type: 'text', text: 'Seeded old-resource user message.' }],
  });
  const assistantContent = JSON.stringify({
    format: 2,
    parts: [{ type: 'text', text: 'Ready from old resource.' }],
  });

  const sql = `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${quoteSql(THREAD_ID)}, ${quoteSql(OLD_RESOURCE_ID)}, ${quoteSql(TITLE)}, ${quoteSql(metadata)}, ${quoteSql(now.toISOString())}, ${quoteSql(now.toISOString())});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values
  (${quoteSql(USER_MESSAGE_ID)}, ${quoteSql(THREAD_ID)}, ${quoteSql(userContent)}, 'user', 'v2', ${quoteSql(now.toISOString())}, ${quoteSql(OLD_RESOURCE_ID)}),
  (${quoteSql(ASSISTANT_MESSAGE_ID)}, ${quoteSql(THREAD_ID)}, ${quoteSql(assistantContent)}, 'assistant', 'v2', ${quoteSql(new Date(now.getTime() + 1000).toISOString())}, ${quoteSql(OLD_RESOURCE_ID)});
insert into mastra_observational_memory (
  id, lookupKey, scope, resourceId, threadId, activeObservations,
  activeObservationsPendingUpdate, originType, config, generationCount,
  lastObservedAt, pendingMessageTokens, totalTokensObserved, observationTokenCount,
  isObserving, isReflecting, observedMessageIds, isBufferingObservation,
  isBufferingReflection, lastBufferedAtTokens, createdAt, updatedAt
)
values (
  'om-resource-drift-source', ${quoteSql(`thread:${THREAD_ID}`)}, 'thread',
  ${quoteSql(OLD_RESOURCE_ID)}, ${quoteSql(THREAD_ID)}, ${quoteSql(SOURCE_OBSERVATIONS)},
  0, ${quoteSql(SOURCE_ORIGIN)}, ${quoteSql(JSON.stringify({ scope: 'thread' }))}, ${SOURCE_GENERATION},
  ${quoteSql(SOURCE_LAST_OBSERVED_AT)}, 0, 42, 42, 0, 0,
  ${quoteSql(JSON.stringify(SOURCE_OBSERVED_MESSAGE_IDS))}, 0, 0, 0,
  ${quoteSql(now.toISOString())}, ${quoteSql(SOURCE_LAST_OBSERVED_AT)}
);
`;
  execFileSync('sqlite3', [dbPath], { input: sql });
}

function queryValue(dbPath: string, sql: string): string {
  return execFileSync('sqlite3', [dbPath, sql], { encoding: 'utf8' }).trim();
}

export const resourceidDriftPromptAcceptScenario: McE2eScenario = {
  name: 'resourceid-drift-prompt-accept',
  description: 'Prompts before cloning an old-resource thread and resumes the clone when accepted.',
  testName: 'accepts resource drift clone prompt and resumes cloned thread',
  prepare({ dbPath, projectDir }) {
    scenarioDbPath = dbPath;
    seedProject(projectDir);
    currentResourceId = detectProject(projectDir).resourceId;
    seedDriftThread(dbPath, projectDir);
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/This directory is tagged on a different resource/i, terminal, 15_000);
    await runtime.waitForScreenText(/Clone and resume/i, terminal, 5_000);
    runtime.printScreen('resource drift prompt', terminal);

    terminal.write('\r');
    await runtime.waitForScreenText(
      /Cloning thread into the current resource|Loading cloned thread/i,
      terminal,
      10_000,
    );
    await runtime.waitForScreenText(/Project:/i, terminal, 10_000);

    await runtime.waitForScreenText(/Ready from old resource/i, terminal, 10_000);
    runtime.printScreen('after accepting clone', terminal);

    const oldThreadResourceId = queryValue(
      scenarioDbPath,
      `select resourceId from mastra_threads where id = ${quoteSql(THREAD_ID)};`,
    );
    if (oldThreadResourceId !== OLD_RESOURCE_ID) {
      throw new Error(`Expected old thread to remain on ${OLD_RESOURCE_ID}, got ${oldThreadResourceId}`);
    }

    const clonedThreadId = queryValue(
      scenarioDbPath,
      `select id from mastra_threads where resourceId = ${quoteSql(currentResourceId)} and title = ${quoteSql(TITLE)} and id != ${quoteSql(THREAD_ID)};`,
    );
    if (!clonedThreadId) {
      throw new Error(`Expected cloned thread on ${currentResourceId}`);
    }

    const oldMessageResourceIds = queryValue(
      scenarioDbPath,
      `select group_concat(distinct resourceId) from mastra_messages where thread_id = ${quoteSql(THREAD_ID)};`,
    );
    if (oldMessageResourceIds !== OLD_RESOURCE_ID) {
      throw new Error(`Expected old messages to remain on ${OLD_RESOURCE_ID}, got ${oldMessageResourceIds}`);
    }

    const clonedMessageResourceIds = queryValue(
      scenarioDbPath,
      `select group_concat(distinct resourceId) from mastra_messages where thread_id = ${quoteSql(clonedThreadId)};`,
    );
    if (clonedMessageResourceIds !== currentResourceId) {
      throw new Error(`Expected cloned message resourceIds ${currentResourceId}, got ${clonedMessageResourceIds}`);
    }

    const clonedMessageIds = queryValue(
      scenarioDbPath,
      `select id from mastra_messages where thread_id = ${quoteSql(clonedThreadId)} order by createdAt asc;`,
    )
      .split('\n')
      .filter(Boolean);
    const clonedOmWhere = `threadId = ${quoteSql(clonedThreadId)} order by generationCount desc limit 1`;
    const clonedActiveObservations = queryValue(
      scenarioDbPath,
      `select activeObservations from mastra_observational_memory where ${clonedOmWhere};`,
    );
    const clonedGeneration = queryValue(
      scenarioDbPath,
      `select generationCount from mastra_observational_memory where ${clonedOmWhere};`,
    );
    const clonedOrigin = queryValue(
      scenarioDbPath,
      `select originType from mastra_observational_memory where ${clonedOmWhere};`,
    );
    const clonedLastObservedAt = queryValue(
      scenarioDbPath,
      `select lastObservedAt from mastra_observational_memory where ${clonedOmWhere};`,
    );
    const clonedObservedMessageIdsRaw = queryValue(
      scenarioDbPath,
      `select observedMessageIds from mastra_observational_memory where ${clonedOmWhere};`,
    );
    let clonedObservedMessageIds: unknown = null;
    try {
      clonedObservedMessageIds = JSON.parse(clonedObservedMessageIdsRaw);
    } catch {
      // Report the raw value in the aggregate mismatch below.
    }

    const mismatches: string[] = [];
    if (clonedActiveObservations !== SOURCE_OBSERVATIONS) {
      mismatches.push(
        `activeObservations: expected ${JSON.stringify(SOURCE_OBSERVATIONS)}, got ${JSON.stringify(clonedActiveObservations)}`,
      );
    }
    if (clonedGeneration !== String(SOURCE_GENERATION) || clonedOrigin !== SOURCE_ORIGIN) {
      mismatches.push(
        `generation/origin: expected ${SOURCE_GENERATION}/${SOURCE_ORIGIN}, got ${clonedGeneration || '<missing>'}/${clonedOrigin || '<missing>'}`,
      );
    }
    if (clonedLastObservedAt !== SOURCE_LAST_OBSERVED_AT) {
      mismatches.push(
        `lastObservedAt: expected ${SOURCE_LAST_OBSERVED_AT}, got ${clonedLastObservedAt || '<missing>'}`,
      );
    }
    if (
      JSON.stringify(clonedObservedMessageIds) !== JSON.stringify(clonedMessageIds) ||
      SOURCE_OBSERVED_MESSAGE_IDS.some(
        id => Array.isArray(clonedObservedMessageIds) && clonedObservedMessageIds.includes(id),
      )
    ) {
      mismatches.push(
        `observedMessageIds: expected cloned IDs ${JSON.stringify(clonedMessageIds)} with no source IDs, got ${clonedObservedMessageIdsRaw || '<missing>'}`,
      );
    }

    const sourceOmWhere = `id = 'om-resource-drift-source'`;
    const sourceActiveObservations = queryValue(
      scenarioDbPath,
      `select activeObservations from mastra_observational_memory where ${sourceOmWhere};`,
    );
    const sourceGeneration = queryValue(
      scenarioDbPath,
      `select generationCount from mastra_observational_memory where ${sourceOmWhere};`,
    );
    const sourceOrigin = queryValue(
      scenarioDbPath,
      `select originType from mastra_observational_memory where ${sourceOmWhere};`,
    );
    const sourceLastObservedAt = queryValue(
      scenarioDbPath,
      `select lastObservedAt from mastra_observational_memory where ${sourceOmWhere};`,
    );
    const sourceObservedMessageIds = queryValue(
      scenarioDbPath,
      `select observedMessageIds from mastra_observational_memory where ${sourceOmWhere};`,
    );
    if (sourceActiveObservations !== SOURCE_OBSERVATIONS) {
      mismatches.push(`source activeObservations: source OM changed unexpectedly`);
    }
    if (sourceGeneration !== String(SOURCE_GENERATION) || sourceOrigin !== SOURCE_ORIGIN) {
      mismatches.push(`source generation/origin: source OM changed unexpectedly`);
    }
    if (sourceLastObservedAt !== SOURCE_LAST_OBSERVED_AT) {
      mismatches.push(`source lastObservedAt: source OM changed unexpectedly`);
    }
    if (sourceObservedMessageIds !== JSON.stringify(SOURCE_OBSERVED_MESSAGE_IDS)) {
      mismatches.push(`source observedMessageIds: source OM changed unexpectedly`);
    }
    if (mismatches.length > 0) {
      throw new Error(`Cloned observational memory mismatch:\n${mismatches.map(line => `- ${line}`).join('\n')}`);
    }

    terminal.keyCtrlC();
  },
};
