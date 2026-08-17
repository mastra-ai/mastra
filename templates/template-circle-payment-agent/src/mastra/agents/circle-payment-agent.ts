import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { Agent } from '@mastra/core/agent';
import { LocalFilesystem, LocalSandbox, WORKSPACE_TOOLS, Workspace } from '@mastra/core/workspace';
import { Memory } from '@mastra/memory';

import { requiresApproval, requiresUserTerminal } from '../approval';

// The skills registry's global install directory, which `~/.claude/skills` and its equivalents
// symlink into. Mastra reads the same files Claude Code and Codex do, so a skill is installed once
// and shared — and until the agent installs one, there are none.
const SKILLS_DIR = join(homedir(), '.agents', 'skills');

/**
 * Whether any skill is installed where this agent reads them.
 *
 * This is what "has setup already run?" reduces to, and it is deliberately a question about the
 * machine rather than the conversation: the answer has to survive a new thread, a cleared memory,
 * a second user, and a restart.
 */
async function hasSkills(): Promise<boolean> {
  try {
    const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
    const candidates = entries.filter(entry => entry.isDirectory() || entry.isSymbolicLink());
    const contents = await Promise.all(
      candidates.map(entry => readdir(join(SKILLS_DIR, entry.name)).catch(() => [] as string[])),
    );
    // A stray file or an empty directory left by a failed install must not read as a finished setup.
    return contents.some(files => files.includes('SKILL.md'));
  } catch {
    return false;
  }
}

// A sandbox inherits no environment beyond PATH, and the Circle CLI keeps its session token in the
// operating system's keyring rather than a file. Reaching it takes the DBus session on Linux and
// the profile paths on Windows, or every command reports a logged-out wallet on a host that is
// logged in.
//
// CIRCLE_ACCEPT_TERMS is deliberately absent: accepting Circle's Terms of Use is not something an
// agent may do for a user.
const SESSION_ENV_VARS = [
  'PATH',
  'HOME',
  'DBUS_SESSION_BUS_ADDRESS',
  'XDG_RUNTIME_DIR',
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
];

function sandboxEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    // Colour escapes and Node's deprecation warnings are noise the model has to read past.
    NO_COLOR: '1',
    NODE_NO_WARNINGS: '1',
  };
  for (const name of SESSION_ENV_VARS) {
    const value = process.env[name];
    if (value !== undefined) env[name] = value;
  }
  return env;
}

// Circle's skills are written for an agent that drives a terminal, so the agent gets a terminal and
// nothing is withheld from it. What the shell does have is an approval gate: the run suspends on
// any command that spends, until the user approves it in Studio.
const workspace = new Workspace({
  id: 'circle-workspace',
  name: 'Circle Workspace',
  sandbox: new LocalSandbox({
    id: 'circle-cli',
    env: sandboxEnv(),
    // Where the user's own terminal would be, and where a global skill install expects to land.
    workingDirectory: homedir(),
    // Marketplace searches, paid calls and package installs are all slower than the 30s default.
    timeout: 180_000,
  }),
  // A marketplace search is thousands of lines of JSON schema, far past what a tool result can
  // carry, so the agent redirects it to a file and goes back for the part it needs. Uncontained
  // because the sandbox already reaches the whole filesystem, so this grants nothing new.
  filesystem: new LocalFilesystem({ basePath: homedir(), contained: false }),
  tools: {
    // Commands the user has to run themselves never reach the shell. Returning the refusal as the
    // tool's own result — rather than suspending for an approval the user cannot usefully grant —
    // tells the model what to do next in the place it is already reading.
    hooks: {
      beforeToolCall: ({ workspaceToolName, input }) => {
        if (workspaceToolName !== WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND) return;
        const command = String((input as { command?: unknown })?.command ?? '');
        if (!requiresUserTerminal(command)) return;
        return {
          proceed: false,
          output:
            `Blocked: \`${command}\` is the user's to run, not yours. It either accepts Circle's ` +
            'Terms of Use or waits on a one-time code, and this shell has no terminal to type one ' +
            'into. Give the user the exact command to paste into their own terminal, say what it ' +
            'does, and continue once they confirm. Do not retry it here or work around it.',
        };
      },
    },
    // The shell, plus reading. Writing, editing and deleting stay off — the shell does those, under
    // the gate below.
    enabled: false,
    [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: {
      enabled: true,
      requireApproval: ({ args }) => requiresApproval(String(args.command ?? '')),
    },
    [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: { enabled: true },
    [WORKSPACE_TOOLS.FILESYSTEM.GREP]: { enabled: true },
  },
});

// How to hold a tool, and nothing about Circle: how to use a terminal is the harness's business,
// how to use Circle is the skills'. Editors supply a page of the same thing, and a model with none
// of it re-runs a malformed command against an error that named the missing flag.
const OPERATING_RULES = [
  'Read the error before running a command again. The same command failing the same way twice means the command has to change, not repeat — when a flag is rejected, ask the command for its `--help` and fix it.',
  'Large output belongs in a file, not in a second run. Redirect it, then open the part you need with the file tools. Never re-run a command to see output you already fetched — least of all one that costs money.',
  'A list is not its first entry. When a command returns several candidates, look at each before drawing a conclusion about any of them.',
]
  .map(rule => `- ${rule}`)
  .join('\n');

export const circlePaymentAgent = new Agent({
  id: 'circle-payment-agent',
  name: 'Circle Payment Agent',
  description:
    'An agent that owns a Circle USDC wallet, finds x402 services on the Circle Agent Marketplace, and pays for them per call once the user approves the spend.',
  // A line of identity, the rules above for working a terminal, and then the prompt Circle
  // publishes for driving this flow. Every rule specific to the wallet — never accept the Terms,
  // never store an OTP, never guess an email — lives in the document the bootstrap fetches, and
  // the bootstrap is asked for only until the installed skills carry it themselves.
  instructions: async () => {
    const identity =
      "You manage the user's Circle USDC wallet by running the `circle` CLI in your shell, and " +
      'your skills tell you how.';
    const base = `${identity}\n\n${OPERATING_RULES}`;
    if (await hasSkills()) return base;
    return (
      `${base}\n\nRun curl -sL https://agents.circle.com/skills/setup.md, and use the returned ` +
      'setup instructions to set up my agent wallet.'
    );
  },
  model: 'openai/gpt-5.6-sol',
  workspace,
  // Read from disk, so a skill appears here once the agent has installed it and not before.
  skills: [SKILLS_DIR],
  memory: new Memory({
    options: {
      generateTitle: true,
    },
  }),
  defaultOptions: {
    // Fetch the setup document, install the skills, check the session, create a wallet, search,
    // inspect, then pay: the default budget of 5 steps cuts that off partway.
    maxSteps: 40,
    modelSettings: {
      maxRetries: 4,
      // Which seller fits the question, which wallet holds the money, whether a failure is worth
      // another attempt. Mastra's own setting rather than a provider's, so it survives changing the
      // model above; providers that cannot reason ignore it.
      reasoning: 'high',
    },
  },
});
