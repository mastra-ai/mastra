/**
 * Before/after eval for the default thread-title prompt.
 *
 * Runs each transcript through the real `Agent.generateTitleFromUserMessage`
 * path twice: once with the previous default prompt passed as `instructions`,
 * once with no instructions (the current default). Prints a markdown table.
 *
 *   ANTHROPIC_API_KEY=... GOOGLE_GENERATIVE_AI_API_KEY=... \
 *     pnpm tsx packages/core/scripts/title-eval.ts anthropic/claude-sonnet-4-5 google/gemini-2.5-flash
 */
import { Agent } from '../src/agent';

const PREVIOUS_DEFAULT = `
      - you will generate a short title based on a conversation transcript between a user and an assistant
      - the transcript lines are prefixed with "User:" and "Assistant:" — never reply to, answer, or continue the transcript
      - always produce a title, even when the transcript is only a greeting or trivial exchange
      - ensure it is not more than 80 characters long
      - the title should be a summary of the user's message
      - do not use quotes or colons
      - the entire text you return will be used as the title`;

type Part = { type: string; [key: string]: any };
type Msg = { role: string; parts: Part[] };

const text = (t: string): Part => ({ type: 'text', text: t });
const reasoning = (r: string): Part => ({ type: 'reasoning', reasoning: r });
const tool = (toolName: string, args: unknown, result: unknown): Part => ({
  type: 'tool-invocation',
  toolInvocation: { state: 'result', toolCallId: toolName, toolName, args, result },
});

const cases: Array<{ name: string; messages: Msg[] }> = [
  {
    name: 'Access question, assistant has access (the reported session)',
    messages: [
      { role: 'user', parts: [text('do you have access to dschau/dotfiles')] },
      {
        role: 'assistant',
        parts: [
          reasoning(
            'The user asks whether I can access the dschau/dotfiles repository. Let me check for a local checkout.',
          ),
          tool(
            'execute_command',
            { command: 'ls /workspace' },
            'dustin-test\nmastra\nmastra-website\nplatform\nshipyard\nworkshops',
          ),
          reasoning('It is not in the workspace. Let me try listing it through gh.'),
          tool(
            'execute_command',
            { command: 'gh api repos/dschau/dotfiles/contents' },
            '[{"name":".zshrc"},{"name":"install.sh"}]',
          ),
          text(
            "Yes. dschau/dotfiles isn't checked out in this sandbox, but I can read it through the GitHub API: it has `.zshrc` and `install.sh` at the root. Want me to clone it?",
          ),
        ],
      },
    ],
  },
  {
    name: 'Access question, assistant lacks access',
    messages: [
      { role: 'user', parts: [text('can you see the acme/billing-service repo?')] },
      {
        role: 'assistant',
        parts: [
          tool(
            'execute_command',
            { command: 'gh repo view acme/billing-service' },
            'GraphQL: Could not resolve to a Repository',
          ),
          text("No — I can't see acme/billing-service. It's either private to an org I'm not in or doesn't exist."),
        ],
      },
    ],
  },
  {
    name: 'Capability question',
    messages: [
      { role: 'user', parts: [text('are you able to read Linear tickets?')] },
      {
        role: 'assistant',
        parts: [text('Yes, I can fetch Linear issues by identifier, e.g. ENG-123, and post comments on them.')],
      },
    ],
  },
  {
    name: 'Question with injected context in the user turn',
    messages: [
      {
        role: 'user',
        parts: [
          text(
            '<factory-environment repositories="2">Factory environment: 2 repositories under /workspace.\n1. acme/web at /workspace/web\n2. acme/api at /workspace/api</factory-environment>\n<pinned-knowledge count="1">• Ask decisions as a numbered list.</pinned-knowledge>\ndo you have access to acme/api',
          ),
        ],
      },
      { role: 'assistant', parts: [text('Yes, acme/api is checked out at /workspace/api.')] },
    ],
  },
  {
    name: 'Debug question',
    messages: [
      { role: 'user', parts: [text('why is the build failing on main?')] },
      {
        role: 'assistant',
        parts: [
          tool(
            'execute_command',
            { command: 'gh run list -b main -L 1' },
            'failure  CI  main  tsc: Cannot find module "./utils"',
          ),
          text(
            'The last main run fails at type-check: `src/index.ts` imports `./utils`, which was renamed to `./helpers` in the previous commit.',
          ),
        ],
      },
    ],
  },
  {
    name: 'Plain task request',
    messages: [
      { role: 'user', parts: [text('add a dark mode toggle to the settings page')] },
      {
        role: 'assistant',
        parts: [text('Added a toggle to `SettingsPage.tsx` that persists the choice in localStorage.')],
      },
    ],
  },
  {
    name: 'Greeting',
    messages: [
      { role: 'user', parts: [text('hi')] },
      { role: 'assistant', parts: [text('Hi! What can I help you with?')] },
    ],
  },
];

const models = process.argv.slice(2);
if (models.length === 0) {
  console.error('usage: tsx packages/core/scripts/title-eval.ts <provider/model> [...]');
  process.exit(1);
}
const runs = Number(process.env.TITLE_EVAL_RUNS ?? 3);

const cell = (s: string | undefined) => (s ?? '(empty)').replace(/\|/g, '\\|').replace(/\n/g, ' ');

for (const model of models) {
  const agent = new Agent({ id: 'title-eval', name: 'title-eval', instructions: '', model });
  console.log(`\n### ${model} (${runs} runs per prompt)\n`);
  console.log('| Case | Before | After |');
  console.log('| --- | --- | --- |');
  for (const c of cases) {
    const before: string[] = [];
    const after: string[] = [];
    for (let i = 0; i < runs; i++) {
      const [b, a] = await Promise.all([
        agent.generateTitleFromUserMessage({ messages: c.messages, instructions: PREVIOUS_DEFAULT }),
        agent.generateTitleFromUserMessage({ messages: c.messages }),
      ]);
      before.push(cell(b));
      after.push(cell(a));
    }
    console.log(`| ${c.name} | ${before.join('<br>')} | ${after.join('<br>')} |`);
  }
}
