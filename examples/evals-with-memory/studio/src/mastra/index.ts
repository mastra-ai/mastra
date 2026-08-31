/**
 * The Studio surface.
 *
 * Same agent, same scorers, same dataset as the headless exercises — two
 * differences, and both exist so the dashboard has something to show:
 *
 *   1. Storage is a real file (`file:./eval.db`) instead of a temp directory
 *      wiped on exit. Studio reads what previous runs wrote.
 *   2. Scorers are attached to the agent with a sampling rate, so ordinary
 *      chat traffic gets scored live — not just deliberate eval runs.
 *
 * Start it with:
 *   pnpm dev   → http://localhost:4111
 *
 * That one command is enough: `mastra dev` serves both the API and the Studio
 * UI on the same port. (There is also a separate `mastra studio` command that
 * serves only the UI on :3000 for pointing at a remote server — you do not
 * need it for local development, and its default auto-detect does not find a
 * local dev server reliably.)
 */
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MastraCompositeStore } from '@mastra/core/storage';
import { DuckDBStore } from '@mastra/duckdb';
import { MastraEditor } from '@mastra/editor';
import { createBuilderAgent } from '@mastra/editor/ee';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { MastraStorageExporter, Observability, SensitiveDataFilter } from '@mastra/observability';
import { LocalFilesystem, Workspace } from '@mastra/core/workspace';
import { NIMBUS_KNOWLEDGE } from '@workshop/shared/data';
import { echoModel, hasApiKey, JUDGE_MODEL } from '@workshop/shared/models';
import { answerAccuracyScorer, answerRelevancy, supportRubricScorer, toxicity } from '@workshop/shared/scorers';
import { supportDeskTools } from '@workshop/shared/support-tools';
import { webTools } from '@workshop/shared/web-tools';
import { lookupAccount } from '@workshop/shared/tools';
import { supportWorkflow } from '@workshop/shared/workflow';
import { CASE_FILE_INSTRUCTIONS, supportCaseFile } from './case-file.ts';
import { DATABASE_URL, DUCKDB_PATH, WORKSPACE_PATH } from './db-path.ts';

/**
 * Storage is a composite, and the reason is worth understanding rather than
 * copying.
 *
 * LibSQL holds everything by default — agents, memory, datasets, experiments.
 * But Studio's Evaluation → Overview and Scorers views call the *generic*
 * `listScores()`, and LibSQL's scores domain only implements the scoped
 * variants (`listScoresByRunId`, `listScoresByScorerId`, …). The generic call
 * falls through to the abstract base, which throws:
 *
 *   500 — "This storage provider does not support listing scores"
 *
 * Only clickhouse, convex, duckdb, oracledb and pg implement it. DuckDB is the
 * cheapest of those to run locally (a file, no server), so it takes just the
 * observability domain while LibSQL keeps the rest.
 *
 * Both paths are absolute — see db-path.ts.
 */
const libsql = new LibSQLStore({
  id: 'workshop-studio',
  // A real file, deliberately. The headless surface uses a temp directory and
  // deletes it; here the whole point is that runs accumulate.
  url: DATABASE_URL,
});

const duckdb = new DuckDBStore({ id: 'workshop-observability', path: DUCKDB_PATH });

const storage = new MastraCompositeStore({
  id: 'workshop-composite',
  default: libsql,
  domains: {
    observability: await duckdb.getStore('observability'),
  },
});

/**
 * Fall back to the deterministic mock when no key is present, so the Studio
 * demo still runs end-to-end in a room where not everyone has credentials.
 * The LLM-judge scorer below is the part that genuinely requires one.
 */
const model = hasApiKey() ? JUDGE_MODEL : (echoModel(NIMBUS_KNOWLEDGE) as any);

export const supportAgent = new Agent({
  id: 'support-agent',
  name: 'Nimbus Support Agent',
  description: 'Answers Nimbus product questions from the documentation.',
  /**
   * The documentation is inlined into the instructions on purpose.
   *
   * The mock model answers from `NIMBUS_KNOWLEDGE` directly, but a real model
   * has no such thing — with instructions alone it correctly replies "I don't
   * have the Nimbus documentation", which is honest and scores terribly. The
   * live relevancy numbers were 0.0–0.65 until the facts were actually put in
   * front of it.
   *
   * A production agent would retrieve these passages instead of hard-coding
   * them. Inlining keeps the workshop to one moving part; the eval story is
   * identical either way.
   */
  instructions: `You are a support agent for Nimbus, a file-sync service.

You have tools that read live account data, and documentation for general
product facts. Choosing between them is the first decision on every message.

Account questions — anything naming an account id, or describing a problem one
customer is having right now — are answered from the tools, never from the
documentation and never from memory. Start with getAccountOverview. Check
getServiceStatus before you blame an account for a sync failure. Consult the
sync-troubleshooting skill when something is not syncing, and follow its
checklist in order. Keep going until you have a root cause, then say what the
customer should do about it. Never state a number a tool could have told you.

General product questions — plan limits, policies, how something works, with
no particular account involved — are answered from the Nimbus documentation
below, in two sentences at most. If the answer is not in the documentation,
say so plainly rather than guessing.

${CASE_FILE_INSTRUCTIONS}

Nimbus documentation:
${Object.values(NIMBUS_KNOWLEDGE)
  .map(fact => `- ${fact}`)
  .join('\n')}`,
  model,
  /**
   * The support desk, attached to the agent rather than only registered on
   * the Mastra instance below.
   *
   * These are two different things and the difference catches people out.
   * `tools` on `new Mastra({...})` populates the *pickers* — the editor's
   * Tools section, the Builder's capability list — and hands nothing to any
   * agent. `tools` here is what this agent can actually call. A tool can be
   * in one, the other, or both.
   *
   * Deliberately not included: `lookupAccount`, which belongs to exercise 10
   * and carries a mutable-state knob the tool-mocking exercise depends on;
   * and the web tools, so this agent stays offline and its answers stay
   * reproducible. Live search is the Builder's half of the demo.
   */
  tools: supportDeskTools,
  /**
   * -------------------------------------------------------------------------
   * Working memory — state the agent maintains about the conversation.
   *
   * `lastMessages: 10` is recall: the transcript, replayed. Working memory is
   * something else, and the distinction is the point of turning it on here.
   * The transcript is what was *said*; working memory is what the agent has
   * *concluded*, in a shape it chose. It survives past the recall window, it
   * is a fraction of the tokens, and — the part that matters for a demo — it
   * is legible: open the Memory panel beside the chat and there is the
   * agent's state, as JSON, changing as the conversation moves.
   *
   * Editable, too. That panel has an **Edit Working Memory** button, and what
   * you type there is what the agent reads next turn. So it is not a log of
   * the agent's thinking, it is shared state with a human on the other side
   * of it — which is the honest answer to "can I correct it when it gets
   * something wrong". That is why `managed state` is the right phrase for
   * this and `memory` slightly undersells it.
   *
   * `scope: 'thread'` is a deliberate choice over the `'resource'` default,
   * and the reason is specific to this UI. Working memory scoped to a
   * resource persists across every thread belonging to that resource — in
   * production that is a customer, and a case file that survives from ticket
   * to ticket is exactly what you want. But Studio's chat has no notion of
   * who the customer is: it passes the **agent id** as the resourceId (see
   * `memory-sidebar.tsx`, `resourceId={agentId}`). So under resource scope,
   * every conversation with this agent shares one case file, and a brand-new
   * thread about acct-77 opens with acct-42's device count already in it.
   * That reads as a bug to the room, and it teaches the opposite of the
   * `evidence-discipline` skill. One case file per conversation is both
   * correct here and easier to demo: new thread, empty panel, watch it fill.
   *
   * In your own app, pass a real `resource` and switch this to `'resource'`:
   *
   *   await agent.generate(text, {
   *     memory: { thread: ticketId, resource: customerId },
   *   })
   *
   * The panel badge tells you which mode you are in without reading any code:
   * blue `thread`, purple `resource`.
   * -------------------------------------------------------------------------
   */
  memory: new Memory({
    storage,
    options: {
      lastMessages: 10,
      workingMemory: {
        enabled: true,
        scope: 'thread',
        // A schema, not a template — see case-file.ts for why, and for the
        // merge semantics that let the agent update one field at a time.
        schema: supportCaseFile,
      },
    },
  }),
  // ---------------------------------------------------------------------
  // Live scoring — evals watching real traffic instead of a fixed dataset.
  //
  // Which scorers go here is a real decision, not a copy-paste. Live traffic
  // has NO ground truth: nobody labelled the answer a user just received. So
  // only *reference-free* scorers belong here — ones that judge an answer on
  // its own terms.
  //
  // `answer-accuracy` is deliberately absent. It compares the output against
  // `groundTruth`, which is empty on live traffic, so it would score 0 on
  // every single request and paint a healthy agent as totally broken. It
  // stays where labels exist: datasets and experiments.
  //
  // `sampling.rate` is the cost dial: 1 scores everything (fine for a demo),
  // 0.05 scores one in twenty (what you want in production with a judge).
  // ---------------------------------------------------------------------
  scorers: hasApiKey()
    ? {
        // Reference-free: "does this answer the question that was asked?"
        answerRelevancy: {
          scorer: answerRelevancy as any,
          sampling: { type: 'ratio', rate: 1 },
        },
        // Reference-free safety check, cheap enough to run on everything.
        toxicity: {
          scorer: toxicity as any,
          sampling: { type: 'ratio', rate: 1 },
        },
      }
    : // Without a key there is no reference-free scorer available — every
      // code scorer in this workshop needs either groundTruth or expected
      // keywords. Better an empty live feed than a feed of meaningless zeros.
      {},
});

/**
 * Required for live scoring to be visible — not optional decoration.
 *
 * Scores from agent-attached scorers hang off trace spans. With no
 * `Observability` config there are no spans, so nothing is written and
 * Evaluation → Overview stays empty even though the scorers really ran.
 * The symptom is silent: no error anywhere, just zeros.
 *
 * Dataset and experiment scores are unaffected — those persist through the
 * dataset tables regardless. This only governs the live/sampled feed.
 *
 * Exported because spans are flushed in batches: a short-lived script (the
 * seed) exits before the flush and silently leaves no traces at all unless it
 * awaits `observability.shutdown()` first.
 */
export const observability = new Observability({
  configs: {
    default: {
      serviceName: 'evals-with-memory',
      exporters: [new MastraStorageExporter()],
      spanOutputProcessors: [new SensitiveDataFilter()],
    },
  },
});

/**
 * The editor — what turns the prompt from a code constant into something you
 * can change in the browser and then *measure*.
 *
 * Without this, Studio renders the agent's instructions read-only: the prompt
 * lives in this file and the only way to try a variant is to edit, restart,
 * and lose the comparison. With it, editing the prompt writes a **version**,
 * and a version is a thing an experiment can be pinned to. That is the whole
 * reason it earns a place in an evals workshop — see exercise 12.
 *
 * `source: 'db'` is a real choice, not a default worth skipping over:
 *
 *   'db'    edits are stored as versions in the storage above. Studio shows
 *           "Save" and "Publish This Version". This is what you want when the
 *           point is to iterate on a prompt and eval each iteration.
 *
 *   'code'  the prompt is treated as owned by the repository. Studio replaces
 *           Save/Publish with "Download JSON" and "Open PR", and the editor
 *           re-routes its own storage domain to a FilesystemStore — which
 *           would also quietly wrap the composite store built above. That is
 *           the right mode for a team that reviews prompt changes in git, and
 *           the wrong one for a workshop about measuring them.
 *
 * What the editor can and cannot override is worth saying out loud, because
 * the boundary surprises people: `instructions` and `tools` are overridable.
 * `model`, `memory`, and `scorers` are not — they can hold SDK instances and
 * live functions that cannot be serialized into a database row. So a prompt
 * edit made in the browser changes what the agent *says*, never what it runs
 * on. For this workshop that is a feature: the model stays pinned, so a score
 * that moves between versions moved because of the prompt.
 *
 * ---------------------------------------------------------------------------
 * The Agent Builder — the other half of the non-engineer story.
 *
 * Everything above lets someone *change an agent that already exists*. The
 * Builder lets them **create one that doesn't**, by describing it in a
 * sentence. It is a separate surface at `/agent-builder`, and it is off by
 * default: `builder` omitted means no nav entry, and the settings endpoint
 * reports `{"enabled": false}`.
 *
 * Three things have to be true for it to appear, and missing any one of them
 * fails quietly in a different way:
 *
 *   1. `builder: { enabled: true }` here.
 *   2. An agent registered under the id `builder-agent` — the Studio UI looks
 *      that id up by a hard-coded constant, so the key below is not a
 *      convention you can rename. `createBuilderAgent()` sets the id itself.
 *   3. A real model. This one is not negotiable: the Builder's job is to
 *      *author* a prompt, and the deterministic mock this workshop runs on
 *      answers from a fixed knowledge base. It cannot write anything. So the
 *      whole surface is gated on `hasApiKey()` below — with no key you get
 *      the workshop exactly as it was, rather than a Builder that boots and
 *      then fails on first message.
 *
 * Note what is NOT on this list: a licence key. `@mastra/editor/ee` is
 * Enterprise-gated at runtime, but the check passes in any non-production
 * environment (`MASTRA_DEV=true`, or `NODE_ENV` unset / not `production`),
 * which is every `mastra dev`. Expect one warning on boot saying a licence
 * would be required in production. That is the check working, not an error.
 *
 * One difference is worth pointing at during a demo, because it is the reason
 * both surfaces exist. **Agents → Editor** gives you three tabs — Variables,
 * System Prompt, Tools — and gives them to every agent, code-defined or not;
 * that list is hard-coded in Studio 1.23.0. The Builder's own edit screen
 * offers something the editor never does: a **model picker**. The editor has
 * no business showing one, because `model` on a code-defined agent is a live
 * object in this file and there is nothing to write a change back into. On a
 * Builder-created agent the model is just a row, so picking one is allowed.
 *
 * Everything else the Builder sets — memory, workspace, attached skills — it
 * writes onto the stored record without ever rendering a form for it. Check
 * `GET /api/stored/agents` after a build and you will see fields that appear
 * nowhere in either UI.
 */
export const editor = new MastraEditor({
  source: 'db',
  builder: hasApiKey()
    ? {
        enabled: true,
        configuration: {
          agent: {
            /**
             * Every agent the Builder creates starts attached to the Nimbus
             * workspace, so it inherits `skills/eval-triage/` without anyone
             * choosing it. This is a reference by id to the *runtime*
             * workspace defined below — the editor resolves it with
             * `getWorkspaceById`, snapshots it, and persists a DB copy on
             * boot, tagging that copy `metadata.source = 'builder'`.
             */
            workspace: { type: 'id', workspaceId: 'workshop-workspace' },
            /**
             * Pin the model rather than letting the Builder pick. The
             * workshop already depends on one provider; an allowlist keeps a
             * demo from silently reaching for a second one nobody has a key
             * for. Drop `models` entirely to give the room a free picker.
             */
            models: {
              allowed: [{ provider: 'openai' }],
              default: { provider: 'openai', modelId: 'gpt-5-mini' },
            },
          },
        },
        /**
         * Let the Builder browse and install from https://skills.sh.
         *
         * Off by default in Mastra, and the default is the right one for
         * production: installing a skill drops somebody else's operating
         * instructions into your agent's system prompt, which deserves a
         * decision rather than a default. Enabled here because the point of
         * this example is to show the whole surface — with it on, the Builder
         * grows a **Browse registries** entry beside **Create skill**, and a
         * non-engineer can pull in a community skill without a repository.
         *
         * This is the only outbound network call the example makes.
         */
        registries: { skillsSh: { enabled: true } },
      }
    : undefined,
});

/**
 * The workspace — a directory on disk that Studio can browse, search, and read
 * skills out of.
 *
 * Two things come from this, and they are worth separating because they are
 * often confused:
 *
 *   Files   `workspace/` is browsable under Studio's **Workspaces** page. Any
 *           file you drop in there is readable and searchable from the UI.
 *   Skills  every directory under `workspace/skills/` containing a `SKILL.md`
 *           is discovered as a skill — name and description from the
 *           frontmatter, body and `references/` as the content.
 *
 * Skills are just markdown. `skills/eval-triage/` has a `references/` file
 * alongside its `SKILL.md`, which is the multi-file shape the spec expects and
 * what the registry at skills.sh distributes.
 *
 * Registering it here rather than on the agent makes it the *global*
 * workspace: agents inherit it unless they declare their own, so the support
 * agent picks up the skills without needing its own copy.
 *
 * `basePath` is absolute deliberately — see db-path.ts. Under `mastra dev` the
 * process runs from `src/mastra/public`, so a relative path would browse an
 * empty directory and find no skills, with nothing logged to explain it.
 */
export const workspace = new Workspace({
  id: 'workshop-workspace',
  name: 'Nimbus Support Workspace',
  filesystem: new LocalFilesystem({ basePath: WORKSPACE_PATH }),
  // Paths are relative to the workspace root, and each entry is a directory
  // *containing* skill directories — not a skill directory itself.
  skills: ['skills'],
});

/**
 * The agent that does the building.
 *
 * `createBuilderAgent()` ships a ~4,000-word system prompt whose opening line
 * names its audience directly: "non-technical users (Product, founders,
 * operators, business stakeholders)". It is told never to ask a follow-up
 * question, never to mention a tool id or a file path, and to finish the
 * whole agent in one turn. Worth reading once — it is a good answer to "what
 * does a prompt for a non-engineer actually look like".
 *
 * The default model is a flagship; the id below is pinned to a canonical
 * token instead. Building an agent is a long, tool-heavy turn, so this is the
 * one place in the workshop where the cheap model is a false economy.
 */
const builderAgent = hasApiKey() ? createBuilderAgent({ model: 'openai/gpt-5.6-sol' }) : undefined;

export const mastra = new Mastra({
  storage,
  agents: {
    'support-agent': supportAgent,
    // Spread so the key disappears entirely without a key present, rather
    // than registering `undefined` and letting Studio find a broken agent.
    ...(builderAgent ? { 'builder-agent': builderAgent } : {}),
  },
  workflows: { 'support-workflow': supportWorkflow },
  /**
   * The capability surface — and the reason there are thirteen tools here
   * rather than one.
   *
   * Both browser surfaces read this registry: the editor's **Tools** section
   * and the Builder's capability picker. With one tool registered, the
   * Builder has no choice to make and "it picks the minimum set that satisfies
   * the outcome" is an unfalsifiable claim. With thirteen, three different
   * requests produce three visibly different agents, and the selection is the
   * demo.
   *
   * Registering a tool here does **not** give it to any agent — it populates
   * the pickers. The code-defined support agent above takes the nine support
   * desk tools explicitly; the other four are here for the Builder to choose
   * from.
   *
   * `lookupAccount` is exercise 10's tool and stays exactly as it was — it has
   * a mutable-state knob that the tool-mocking exercise depends on, so it is
   * deliberately not folded into the read-only support desk beside it.
   */
  tools: { lookupAccount, ...supportDeskTools, ...webTools },
  observability,
  editor,
  workspace,
  // Registered here so their scores persist and Studio can resolve them by id.
  scorers: {
    'answer-accuracy': answerAccuracyScorer as any,
    'support-rubric': supportRubricScorer as any,
    'answer-relevancy-scorer': answerRelevancy as any,
    'toxicity-scorer': toxicity as any,
  },
});
