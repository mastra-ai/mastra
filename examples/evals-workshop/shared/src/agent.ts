/**
 * The agent under evaluation, in two flavours.
 *
 * Both surfaces of the workshop build their agent from here, so a scorer that
 * runs in the terminal and the same scorer running in Studio are grading the
 * same thing.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { NIMBUS_KNOWLEDGE } from './data/support-qa.ts';
import { echoModel, JUDGE_MODEL } from './models.ts';
import { answerAccuracyScorer } from './scorers/answer-accuracy.ts';
import { supportRubricScorer } from './scorers/support-rubric.ts';
import { supportWorkflow } from './workflow.ts';

const INSTRUCTIONS = `You are a support agent for Nimbus, a file-sync service.
Answer only from the Nimbus documentation you are given. Be concise — two
sentences at most. If you do not know, say so plainly rather than guessing.`;

export type BuildOptions = {
  /**
   * `'mock'` (default) is deterministic and needs no API key — use it for
   * anything that runs in CI. `'live'` calls a real model.
   */
  model?: 'mock' | 'live';
  /**
   * Where conversation memory lives. `'temp'` (default) uses a throwaway
   * directory removed on exit, so headless runs leave nothing behind.
   * `'persistent'` writes to a real file so Studio can read it afterwards.
   */
  storage?: 'temp' | 'persistent';
  /** Path used when `storage: 'persistent'`. */
  dbPath?: string;
  /**
   * Extra scorers to register, keyed by id.
   *
   * Any scorer whose scores you want persisted has to be registered on the
   * Mastra instance — including one-off scorers defined inside an exercise.
   * Skip this and the run still prints scores, but every save logs
   * MASTRA_GET_SCORER_BY_ID_NOT_FOUND and Studio shows nothing.
   */
  scorers?: Record<string, unknown>;
};

export type AgentBundle = {
  mastra: Mastra;
  agent: Agent;
  storage: LibSQLStore;
  cleanup: () => void;
};

export function buildSupportAgent(opts: BuildOptions = {}): AgentBundle {
  const { model = 'mock', storage: storageMode = 'temp', dbPath = 'file:./eval.db', scorers = {} } = opts;

  let url: string;
  let cleanup: () => void;
  if (storageMode === 'persistent') {
    url = dbPath;
    cleanup = () => {};
  } else {
    const dir = mkdtempSync(join(tmpdir(), 'evals-workshop-'));
    url = `file:${join(dir, 'eval.db')}`;
    cleanup = () => {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        void 0;
      }
    };
  }

  const storage = new LibSQLStore({ id: `workshop-${storageMode}`, url });

  const memory = new Memory({
    storage,
    options: {
      lastMessages: 10,
      workingMemory: { enabled: false },
    },
  });

  const agent = new Agent({
    id: 'support-agent',
    name: 'Nimbus Support Agent',
    description: 'Answers Nimbus product questions from the documentation.',
    instructions: INSTRUCTIONS,
    model: model === 'live' ? JUDGE_MODEL : (echoModel(NIMBUS_KNOWLEDGE) as any),
    memory,
  });

  const mastra = new Mastra({
    storage,
    agents: { 'support-agent': agent },
    // Evals are not agent-only — `runEvals` takes a Workflow target too.
    workflows: { 'support-workflow': supportWorkflow },
    // Scorers must be registered here for their scores to persist. Without
    // this, runs still produce scores but every save logs
    // MASTRA_GET_SCORER_BY_ID_NOT_FOUND and nothing reaches storage — so
    // Studio shows an empty dashboard for a run that looked fine in the
    // terminal.
    scorers: {
      'answer-accuracy': answerAccuracyScorer as any,
      'support-rubric': supportRubricScorer as any,
      ...(scorers as Record<string, any>),
    },
  });
  // Resolve the agent through Mastra so memory inherits the configured storage.
  void mastra.getAgent('support-agent');

  return { mastra, agent, storage, cleanup };
}
