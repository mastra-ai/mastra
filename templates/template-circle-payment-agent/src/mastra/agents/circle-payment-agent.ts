import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { Agent } from '@mastra/core/agent';
import type { RequestContext } from '@mastra/core/request-context';
import { LocalFilesystem, LocalSandbox, WORKSPACE_TOOLS, Workspace } from '@mastra/core/workspace';
import { Memory } from '@mastra/memory';

import { installsSkillsElsewhere, requiresApproval, requiresUserTerminal } from '../approval';
import { cliPath, cliPrefix } from '../circle-cli';
import { circleDocFetched, readCircleDoc } from '../circle-docs';
import { ClampedSkillSource } from '../skill-source';
import { gitAvailable, installCircleSkills, installsCircleSkills } from '../skills-install';
import { tenantHome } from '../tenancy';

// The skills registry's global install directory, which `~/.claude/skills` and its equivalents
// symlink into. Mastra reads the same files Claude Code and Codex do, so a skill is installed once
// and shared — and until the agent installs one, there are none.
const skillsDir = (home: string) => join(home, '.agents', 'skills');

// The Circle CLI's own directory: its config, its terms record, its session profiles. Named once
// because two places have to agree on it — the sandbox's environment, and the command handed to a
// user to run in their own terminal.
const circleCliHome = (home: string) => join(home, '.circle-cli');

// The skill Circle's setup document installs first, and the one every wallet command reads. Asking
// for it by name rather than for any skill at all matters on a machine that already has skills:
// this directory is shared with every other agent on it, and an unrelated skill sitting there must
// not read as a finished Circle setup and take the bootstrap away.
const CIRCLE_SKILL = 'use-circle-cli';

/**
 * Whether Circle's skills are installed where this agent reads them.
 *
 * This is what "has setup already run?" reduces to, and it is deliberately a question about the
 * machine rather than the conversation: the answer has to survive a new thread, a cleared memory,
 * a second user, and a restart.
 */
async function hasSkills(home: string): Promise<boolean> {
  try {
    const files = await readdir(join(skillsDir(home), CIRCLE_SKILL));
    // An empty directory left behind by a failed install must not read as a finished setup.
    return files.includes('SKILL.md');
  } catch {
    return false;
  }
}

/**
 * Whether this caller has already been through Circle's setup, judged on the wallet rather than
 * on the skills.
 *
 * `hasSkills` was the only answer to that question, and it is the wrong one on its own. Circle's
 * setup document tells the agent to carry on to the login step if the skill install errors, so an
 * install that fails — no `git` in the image, a network blip — leaves a tenant who has accepted
 * the Terms, signed in, and can spend from a funded wallet, while the directory that stands for
 * "setup ran" was never written. The bootstrap line then returns on every request forever, and the
 * user watches the full sweep in front of every greeting.
 *
 * A terms record and a session on disk are a fact about the same machine, survive the same
 * restarts, and cannot be true of someone who has not been through setup. Read rather than shelled
 * out to, because this runs on every request and `circle wallet status` is a network round trip.
 * Expiry is not checked: an expired session still means setup ran, and the skills know how to log
 * back in.
 */
async function hasWalletSession(home: string): Promise<boolean> {
  const cliHome = circleCliHome(home);

  try {
    const terms = JSON.parse(await readFile(join(cliHome, 'terms.json'), 'utf-8')) as {
      accepted?: unknown;
    };
    if (terms.accepted !== true) return false;
  } catch {
    return false;
  }

  try {
    const profiles = await readdir(join(cliHome, 'profiles'), { withFileTypes: true });

    for (const profile of profiles) {
      if (!profile.isDirectory()) continue;
      const files = await readdir(join(cliHome, 'profiles', profile.name));
      if (files.includes('session.json')) return true;
    }
  } catch {
    return false;
  }

  return false;
}

// The home directory of whoever made the request a hook is running inside.
//
// Both hooks are handed the tool's own execution context, which carries the
// `requestContext` the workspace resolvers were built from — so a message about
// "your directory" can name the caller's rather than the account the server
// happens to run as. Without this every such message points somewhere the
// caller's shell cannot see, which under per-caller homes is always.
const callerContext = (context: unknown): RequestContext | undefined =>
  (context as { requestContext?: RequestContext } | undefined)?.requestContext;

const callerHome = (context: unknown): string => tenantHome(callerContext(context));

// A sandbox inherits no environment beyond PATH, so everything the Circle CLI needs is named here.
//
// The DBus session is deliberately *not* forwarded, and that omission is what keeps two callers off
// one wallet. The CLI keeps its session token in the operating system's keyring under an account
// name of `${profile}-${type}-${env}` — `agent-session-mainnet` — which has nothing in it that
// varies per caller. One keyring reachable from every sandbox means the second caller to log in
// overwrites the first, and the first's next command pairs its own `session.json` metadata with the
// second's token: it quietly operates a wallet that is not its own. A per-caller HOME does not help
// here, because the token is the one part of the session that does not live under it.
//
// With no keyring in reach the CLI says so once on stderr and writes the session to
// `$CIRCLE_CLI_HOME/profiles/<type>/session.json` at 0600 instead — under this caller's directory,
// which is the point. A token at rest in a file is worse than one in a keyring; a token shared
// between callers is worse than either.
//
// CIRCLE_ACCEPT_TERMS is deliberately absent: accepting Circle's Terms of Use is not something an
// agent may do for a user.
const SESSION_ENV_VARS = [
  'PATH',
  'HOME',
  // Lets child Node processes use host TLS settings such as `--use-system-ca` behind Zscaler.
  'NODE_OPTIONS',
  // npm's own directories on Windows, which the skills install needs. Nothing to do with the
  // session: the CLI looks for a keyring on darwin and linux only, so Windows is on the file
  // fallback whether these are set or not.
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
];

function sandboxEnv(home: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    // Colour escapes and Node's deprecation warnings are noise the model has to read past.
    NO_COLOR: '1',
    NODE_NO_WARNINGS: '1',
  };
  for (const name of SESSION_ENV_VARS) {
    const value = process.env[name];
    if (value !== undefined) env[name] = value;
  }
  // HOME last, so it wins over the inherited one: it is what sends the Circle
  // CLI's config, and the skills install, to this caller's directory rather
  // than to the account the server happens to run as.
  env.HOME = home;
  env.USERPROFILE = home;
  // Where `npm install -g` puts the Circle CLI, decided here rather than left to
  // whatever the container's default prefix happens to be. Deployed, that
  // default is root-owned and the install fails; the model's usual recovery is
  // to pick a prefix of its own and prepend it to PATH by hand, which works for
  // the shell and for nothing else. The control plane runs the two commands this
  // agent is blocked from running, in a separate process with a PATH of its own,
  // and it can only find a binary whose location was agreed in advance rather
  // than improvised mid-conversation. `cliPath` is that agreement.
  env.npm_config_prefix = cliPrefix(home);
  env.PATH = cliPath(home);
  // The directory HOME would have produced anyway, said outright. The CLI reads this ahead of its
  // own `homedir()` for the config, the terms record and the profiles, so a caller's session no
  // longer rests on how one child process happens to resolve a home directory.
  env.CIRCLE_CLI_HOME = circleCliHome(home);
  return env;
}

/**
 * Rebuild the skill catalogue if an install has just landed and it does not know yet.
 *
 * A catalogue built before the install does not contain what the install wrote, and Mastra only
 * re-reads the directory every 30 seconds — a window the agent crosses in one step, so the skill
 * it installed is missing from the tool that would activate it. Rather than guess how the install
 * was spelled, this asks the cheaper question: the skill is on disk and it is not in the
 * catalogue, so the catalogue is stale. `refresh()` rebuilds it now, where `maybeRefresh()` would
 * decline until the window expired.
 *
 * Called from two places, which is why it is a function: after any command that succeeded, and
 * directly after the git-free install below, whose whole point is that no command ran.
 */
async function refreshSkillCatalogue(context: unknown, home: string): Promise<void> {
  if (!(await hasSkills(home))) return;
  const root = workspace.skills;
  if (!root) return;
  // `workspace.skills` is the unscoped view, and reading it directly is what
  // broke here: every one of its methods resolves the paths by calling the
  // resolver below with no context at all, and a resolver that needs a caller
  // to name a directory throws rather than returning one. The tool had already
  // run by then, so a finished command came back as a failure — and only once
  // the skills it was watching for existed, which is why setup succeeding is
  // what started it. `getScoped` runs the resolver once with this caller's
  // `requestContext` and pins the view to the directory it named; the agent
  // resolves the same view for the same caller, so the refresh lands on the
  // catalogue the next step reads.
  const skills = (await root.getScoped?.({ requestContext: callerContext(context) })) ?? root;
  const known = await skills.list();
  if (known.some(skill => skill.name === CIRCLE_SKILL)) return;
  await skills.refresh();
}

// Circle's skills are written for an agent that drives a terminal, so the agent gets a terminal and
// nothing is withheld from it. What the shell does have is an approval gate: the run suspends on
// any command that spends, until the user approves it in Studio.
const workspace = new Workspace({
  id: 'circle-workspace',
  name: 'Circle Workspace',
  // Resolved per request rather than built once: one sandbox per caller, which
  // is what stops two of them sharing a wallet. The same locally and deployed —
  // the caller's `user-id` is the only thing that picks a home, so there is no
  // second mode to be surprised by.
  sandbox: ({ requestContext }) => {
    const home = tenantHome(requestContext);

    return new LocalSandbox({
      id: `circle-cli-${basename(home)}`,
      env: sandboxEnv(home),
      // Where the user's own terminal would be, and where a global skill install expects to land.
      workingDirectory: home,
      // Marketplace searches, paid calls and package installs are all slower than the 30s default.
      timeout: 180_000,
    });
  },
  // Background-process tools have to reach the sandbox a previous request
  // created, so the cache is keyed on the caller rather than on the request.
  sandboxCacheKey: ({ requestContext }) => tenantHome(requestContext),
  // A marketplace search is thousands of lines of JSON schema, far past what a tool result can
  // carry, so the agent redirects it to a file and goes back for the part it needs. Uncontained
  // because the sandbox already reaches the whole filesystem, so this grants nothing new.
  filesystem: ({ requestContext }) =>
    new LocalFilesystem({ basePath: tenantHome(requestContext), contained: false }),
  // Read from disk, so a skill appears here once the agent has installed it and not before. The
  // skills live on the workspace rather than on the agent because only the workspace takes a
  // source, and a source is what lets Circle's over-long descriptions through — see
  // `../skill-source`.
  // Per caller for the same reason the sandbox is: a skill this request
  // installed lands in this request's home, and that is the only directory it
  // should be found in.
  skills: ({ requestContext }) => [skillsDir(tenantHome(requestContext))],
  skillSource: new ClampedSkillSource(),
  tools: {
    // Commands the user has to run themselves never reach the shell, and neither does the install
    // that would strand the skills off to one side. Returning the refusal as the tool's own result
    // — rather than suspending for an approval the user cannot usefully grant — tells the model
    // what to do next in the place it is already reading. The same door answers a fetch of one of
    // Circle's documents with the document itself, because the shell would hand back only its
    // last page.
    hooks: {
      beforeToolCall: async ({ workspaceToolName, input, context }) => {
        if (workspaceToolName !== WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND) return;
        const command = String((input as { command?: unknown })?.command ?? '');
        const home = callerHome(context);
        if (requiresUserTerminal(command)) {
          return {
            proceed: false,
            output:
              `Blocked: \`${command}\` is the user's to run, not yours. It either accepts Circle's ` +
              'Terms of Use or waits on a one-time code, and this shell has no terminal to type one ' +
              'into. Give the user this exact line to paste into their own terminal:\n\n' +
              `    HOME=${home} CIRCLE_CLI_HOME=${circleCliHome(home)} ${command}\n\n` +
              'Neither prefix is optional, and neither may be dropped or explained away. Your ' +
              "workspace is that directory, and this command run without them writes to the user's " +
              'own home instead, where you will never see the result — the login would appear to ' +
              'succeed and your next `circle wallet status` would still report logged out. ' +
              '`CIRCLE_CLI_HOME` is spelled out rather than left to follow from `HOME`, because a ' +
              'user who already sets it in their shell profile would otherwise land back in their ' +
              'own directory with `HOME` set correctly. Say what the command does, and continue ' +
              'once they confirm. Do not retry it here or work around it.',
          };
        }
        // Ahead of the redirect below, because with no `git` the command it redirects *to* fails
        // the same way. Only then: on a machine with git this never fires and the shell runs the
        // install as it always has.
        if (installsCircleSkills(command) && !(await gitAvailable())) {
          const report = await installCircleSkills(skillsDir(home));
          if (report) {
            await refreshSkillCatalogue(context, home);
            return { proceed: false, output: report };
          }
        }
        if (installsSkillsElsewhere(command)) {
          return {
            proceed: false,
            output:
              `Blocked: \`${command}\` installs skills into an editor's own directory, and I read ` +
              `mine from ${skillsDir(home)}. Use the universal fallback from the same setup document ` +
              'instead — `npx -y skills add circlefin/skills -g` — which is what writes there. It ' +
              'installs into every editor store it knows of, so a long list of destinations in its ' +
              'output is expected. Then carry on with the setup.',
          };
        }
        const docUrl = circleDocFetched(command);
        if (docUrl) {
          const doc = await readCircleDoc(docUrl);
          // A failed fetch falls through to the shell rather than reporting an error: `curl` may
          // succeed where this did not, and a truncated document beats none at all.
          if (doc) return { proceed: false, output: doc };
        }
        return;
      },
      // A catalogue built before the install does not contain what the install just wrote, and
      // Mastra only re-reads the directory every 30 seconds — a window the agent crosses in one
      // step, so the skill it installed is missing from the tool that would activate it. Rather
      // than guess how the install was spelled, this asks the cheaper question: the skill is on
      // disk and it is not in the catalogue, so the catalogue is stale. `refresh()` rebuilds it
      // now, where `maybeRefresh()` would decline until the window expired.
      afterToolCall: async ({ workspaceToolName, context }) => {
        if (workspaceToolName !== WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND) return;
        let home: string;
        try {
          home = callerHome(context);
        } catch {
          // Unreachable in practice — the sandbox resolver needs the same
          // identity and runs first — but this hook trails a command that has
          // already succeeded, and one of those commands spends money. Losing
          // a catalogue refresh is the acceptable failure here; throwing over
          // a completed payment is not.
          return;
        }
        await refreshSkillCatalogue(context, home);
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

// Any model Mastra can route to. Read from the environment so swapping providers is an edit to
// `.env` and its matching API key rather than to this file.
const MODEL = process.env.AGENT_MODEL || 'openai/gpt-5.6-sol';

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
  instructions: async ({ requestContext }) => {
    const identity =
      "You manage the user's Circle USDC wallet by running the `circle` CLI in your shell, and " +
      'your skills tell you how.';
    const base = `${identity}\n\n${OPERATING_RULES}`;

    // `GET /api/agents/:id` — what Studio and the deploy dashboard call to show
    // the agent — resolves this with no caller attached, and refusing there
    // takes the agent out of both. Answering is safe in a way that answering a
    // run is not: this returns a string, and reaches no shell, no files and no
    // wallet. The bootstrap line is dropped rather than added, because "setup
    // has not run" is a claim about a home directory and there is no home
    // directory in the question.
    let home: string;
    try {
      home = tenantHome(requestContext);
    } catch {
      return base;
    }

    if ((await hasSkills(home)) || (await hasWalletSession(home))) return base;
    return (
      `${base}\n\nRun curl -sL https://agents.circle.com/skills/setup.md, and use the returned ` +
      'setup instructions to set up my agent wallet.'
    );
  },
  model: MODEL,
  workspace,
  memory: new Memory({
    options: {
      generateTitle: true,
      // Mastra's default is 10, which this agent crosses before it has finished
      // introducing itself: fetching the setup document, installing skills,
      // checking the session and creating a wallet are each a message with a
      // tool result attached. At 10 the agent forgets it already ran setup and
      // runs it again.
      lastMessages: 40,
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
