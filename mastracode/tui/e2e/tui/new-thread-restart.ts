import { DatabaseSync } from 'node:sqlite';
import { detectProject } from '@mastra/code-sdk/utils/project';
import type { Session } from '@mastra/core/agent-controller';
import type { McE2eScenario } from './types.js';

export const newThreadRestartScenario: McE2eScenario = {
  name: 'new-thread-restart',
  description: 'Keep an explicit blank /new thread selected after restarting Mastra Code.',
  testName: 'resumes an explicit blank /new thread after restart',
  prepare({ dbPath, projectDir }) {
    const project = detectProject(projectDir);
    const timestamp = '2026-06-06T14:30:00.000Z';
    const db = new DatabaseSync(dbPath);
    try {
      db.prepare(
        'insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt) values (?, ?, ?, ?, ?, ?)',
      ).run(
        'thread-mc-e2e-older',
        project.resourceId,
        'Older persisted thread',
        JSON.stringify({ projectPath: project.rootPath }),
        timestamp,
        timestamp,
      );
    } finally {
      db.close();
    }
  },
  async run({ terminal, runtime, dbPath }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Older persisted thread/i, terminal);

    terminal.submit('/new');
    await runtime.waitForScreenText(/Ready for new conversation/i, terminal);
    terminal.submit('/thread');
    await runtime.waitForScreenText(/Title: \(untitled\)/i, terminal);

    const db = new DatabaseSync(dbPath);
    let newThreadId: string;
    try {
      const row = db
        .prepare("select id, metadata from mastra_threads where title = '' order by updatedAt desc limit 1")
        .get() as { id?: string; metadata?: Uint8Array } | undefined;
      if (!row?.id || !row.metadata || !Buffer.from(row.metadata).includes('explicitNewThread')) {
        throw new Error('Expected /new to persist a thread marked explicitNewThread');
      }
      newThreadId = row.id;
    } finally {
      db.close();
    }

    if (!runtime.restartApp) throw new Error('The TUI E2E backend does not support restarting the app');
    let restartedSession: Session | undefined;
    await runtime.restartApp({
      onCreated(result) {
        restartedSession = result.session;
      },
    });
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    terminal.submit('/thread');
    await runtime.waitForScreenText(/Title: \(untitled\)/i, terminal);
    const restartedThreadId = restartedSession?.thread.getId();
    if (restartedThreadId !== newThreadId) {
      throw new Error(`Expected restart to resume ${newThreadId}, received ${String(restartedThreadId)}`);
    }
    runtime.printScreen('explicit /new thread after restart', terminal);

    terminal.keyCtrlC();
  },
};
