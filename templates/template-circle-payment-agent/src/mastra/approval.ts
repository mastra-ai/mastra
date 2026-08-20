// Which shell commands stop for the user first, and which the agent may not run at all.
//
// Most of what the agent does is recoverable, so the default is to run. What stops is what cannot
// be taken back: a stablecoin transfer has no chargeback, and x402 settles before the seller
// answers. This is not a sandbox — it does not stop the agent deleting files or installing
// packages. For a ceiling no instruction can argue past, cap spending with `circle wallet limit
// set`.
//
// Three lists, because "stop and ask", "not yours to run" and "right idea, wrong destination" are
// different answers. Approval is for a spend the user can weigh and allow. The second list is for
// commands that belong in the user's own terminal — accepting Terms of Use, and anything Circle
// confirms with a one-time code — which no approval can make safe or even workable here: the
// sandbox has no terminal to type a code into, so an approved login would sit at a prompt until it
// timed out. The third is for a command that would run perfectly well and leave the agent no
// better off, because it writes its skills somewhere this agent never reads.

/** Matched anywhere in a segment, so a pipe or a `$(…)` cannot slip one through. */
const SPENDS: readonly RegExp[] = [
  // Buying from a seller. x402 charges before the request resolves, so this is spent on send.
  /\bcircle services pay\b/,
  // Sending USDC to an address, with no seller to check the destination against.
  /\bcircle wallet transfer\b/,
  /\bcircle bridge transfer\b/,
  // Moving USDC into or out of the Gateway pool, which costs the amount plus a fee.
  /\bcircle gateway (deposit|withdraw)\b/,
  // A signature can authorise a later transfer, so it spends just as surely, only afterwards.
  /\bcircle wallet (swap|execute|sign)\b/,
];

/** Commands only the user can complete, in a terminal the agent does not have. */
const USER_ONLY: readonly RegExp[] = [
  // Circle's own rule: an agent must never accept the Terms of Use on a user's behalf.
  /\bcircle terms (accept|reset)\b/,
  // Both wait on a one-time code, which must never pass through the agent.
  /\bcircle wallet login\b/,
  /\bcircle wallet limit (set|reset)\b/,
];

/**
 * Installs that put skills where this agent does not look.
 *
 * Circle's setup document asks for the command "matching the host", and this host is not on its
 * list: `--tool claude-code` installs into an editor's plugin directory, and `--tool codex` writes
 * `.agents/skills` relative to the working directory rather than the home one. The same document
 * publishes a universal fallback that always writes the tool-neutral store, which is the only
 * directory the agent reads, so the choice is taken away rather than left to a guess.
 */
const WRONG_SKILL_STORE: readonly RegExp[] = [/\bcircle skill install\b/];

// `circle services pay --estimate` returns a price without signing, and `--help` prints text.
// Prompting for either trains the user to approve payment dialogs without reading them.
const ESTIMATE = /(?:^| )--estimate(?: |$)/;
const HELP = /(?:^| )(?:--help|-h)(?: |$)/;

/**
 * Whether a single command — no chaining left in it — spends nothing despite naming a gated
 * command.
 *
 * The segment has to *start* with the gated command, so a payment hidden inside a substitution
 * (`echo $(circle services pay …) --estimate`) stays gated.
 */
function isReadOnlyInvocation(segment: string): boolean {
  if (HELP.test(segment)) return true;
  if (!segment.startsWith('circle services pay ')) return false;
  // One payment per segment: `circle services pay X --estimate $(circle services pay Y)` reads as
  // an estimate but contains a real purchase.
  const payments = segment.match(/\bcircle services pay\b/g) ?? [];
  return payments.length === 1 && ESTIMATE.test(segment);
}

/**
 * A shell line is not one command, so it is split and each piece judged on its own: any one of
 * them is enough to stop the whole line.
 */
function segmentsOf(command: string): string[] {
  return command
    .split(/\|\||&&|[;|\n]/)
    .map(segment => segment.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
}

function matches(command: string, patterns: readonly RegExp[]): boolean {
  return segmentsOf(command).some(
    segment => patterns.some(pattern => pattern.test(segment)) && !isReadOnlyInvocation(segment),
  );
}

/**
 * Whether `command` spends money, and so needs the user to approve it before it runs.
 *
 * Deliberately narrow. Everything else — searching the marketplace, reading balances, installing
 * skills — runs immediately, because an approval prompt the user answers by reflex protects
 * nothing when the one that matters arrives.
 */
export function requiresApproval(command: string): boolean {
  return matches(command, SPENDS);
}

/** Whether `command` is one the user has to run themselves. */
export function requiresUserTerminal(command: string): boolean {
  return matches(command, USER_ONLY);
}

/** Whether `command` installs skills somewhere this agent would never find them. */
export function installsSkillsElsewhere(command: string): boolean {
  return matches(command, WRONG_SKILL_STORE);
}
