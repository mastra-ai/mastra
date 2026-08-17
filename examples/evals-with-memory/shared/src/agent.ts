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
import { MastraEditor } from '@mastra/editor';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { NIMBUS_KNOWLEDGE } from './data/support-qa.ts';
import { echoModel, JUDGE_MODEL, toolCallingModel } from './models.ts';
import { answerAccuracyScorer } from './scorers/answer-accuracy.ts';
import { supportRubricScorer } from './scorers/support-rubric.ts';
import { lookupAccount } from './tools.ts';
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
   * Register a `MastraEditor`, which is what makes agent *versions* possible.
   *
   * Off by default: it costs nothing at runtime, but every exercise that does
   * not need it is better off without the extra moving part. Exercise 12 turns
   * it on — that is where prompt versions get evaluated.
   */
  editor?: boolean;
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
  /** Present only when `editor: true` was passed. */
  editor?: MastraEditor;
  cleanup: () => void;
};

export function buildSupportAgent(opts: BuildOptions = {}): AgentBundle {
  const {
    model = 'mock',
    storage: storageMode = 'temp',
    dbPath = 'file:./eval.db',
    scorers = {},
    editor: withEditor = false,
  } = opts;

  let url: string;
  let cleanup: () => void;
  if (storageMode === 'persistent') {
    url = dbPath;
    cleanup = () => {};
  } else {
    const dir = mkdtempSync(join(tmpdir(), 'evals-with-memory-'));
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

  const editor = withEditor ? new MastraEditor({ source: 'db' }) : undefined;

  const mastra = new Mastra({
    storage,
    agents: { 'support-agent': agent },
    // Evals are not agent-only — `runEvals` takes a Workflow target too.
    workflows: { 'support-workflow': supportWorkflow },
    ...(editor ? { editor } : {}),
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

  return { mastra, agent, storage, editor, cleanup };
}

/** The prompt the agent ships with — exercise 12 versions it. */
export const SUPPORT_INSTRUCTIONS = INSTRUCTIONS;

/**
 * A second agent, this one with a tool — for the tool-mocking exercise.
 *
 * Kept separate from the support agent rather than bolted onto it, because
 * tool mocks apply per experiment and mixing tool-using and text-only items in
 * one dataset would muddy what the exercise is showing.
 *
 * The model is the deterministic `toolCallingModel`, so the *decision to call
 * the tool* is fixed and the only thing that varies between runs is what the
 * tool returns. That isolation is the whole point: it makes the tool the
 * single source of non-determinism, which is what mocks then remove.
 */
export function buildBillingAgent(opts: BuildOptions = {}): AgentBundle {
  const { storage: storageMode = 'temp', dbPath = 'file:./eval.db', scorers = {} } = opts;

  let url: string;
  let cleanup: () => void;
  if (storageMode === 'persistent') {
    url = dbPath;
    cleanup = () => {};
  } else {
    const dir = mkdtempSync(join(tmpdir(), 'evals-with-memory-'));
    url = `file:${join(dir, 'eval.db')}`;
    cleanup = () => {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        void 0;
      }
    };
  }

  const storage = new LibSQLStore({ id: `workshop-billing-${storageMode}`, url });

  const agent = new Agent({
    id: 'billing-agent',
    name: 'Nimbus Billing Agent',
    description: 'Answers questions about a customer account by looking it up.',
    instructions: `You are a Nimbus billing agent. When asked about an account,
call lookupAccount to get the current plan and storage usage, then answer in
one sentence using the numbers it returns. Never guess at usage figures.`,
    model: toolCallingModel('lookupAccount', 'acct-42') as any,
    tools: { lookupAccount },
  });

  const mastra = new Mastra({
    storage,
    agents: { 'billing-agent': agent },
    scorers: {
      'answer-accuracy': answerAccuracyScorer as any,
      ...(scorers as Record<string, any>),
    },
  });
  void mastra.getAgent('billing-agent');

  return { mastra, agent, storage, cleanup };
}
