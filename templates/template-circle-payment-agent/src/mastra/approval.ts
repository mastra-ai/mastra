// Which shell commands stop for the user first.
//
// Most of what the agent does is recoverable, so the default is to run. What stops is what cannot
// be taken back: a stablecoin transfer has no chargeback, and x402 settles before the seller
// answers. This is not a sandbox — it does not stop the agent deleting files or installing
// packages. For a ceiling no instruction can argue past, cap spending with `circle wallet limit
// set`.

/** Matched anywhere in a segment, so a pipe or a `$(…)` cannot slip one through. */
const NEEDS_APPROVAL: readonly RegExp[] = [
  // Buying from a seller. x402 charges before the request resolves, so this is spent on send.
  /\bcircle services pay\b/,
  // Sending USDC to an address, with no seller to check the destination against.
  /\bcircle wallet transfer\b/,
  /\bcircle bridge transfer\b/,
  // Moving USDC into or out of the Gateway pool, which costs the amount plus a fee.
  /\bcircle gateway (deposit|withdraw)\b/,
  // A signature can authorise a later transfer, so it spends just as surely, only afterwards.
  /\bcircle wallet (swap|execute|sign)\b/,
  // The ceiling every other entry here relies on.
  /\bcircle wallet limit (set|reset)\b/,
  // Circle's own rules: the agent must never accept the Terms of Use for the user, and login waits
  // on a one-time code this sandbox has no way to answer.
  /\bcircle terms (accept|reset)\b/,
  /\bcircle wallet login\b/,
];

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
 * Whether `command` needs the user to approve it before it runs.
 *
 * A shell line is not one command, so it is split first and each piece judged on its own: any one
 * of them is enough to stop the whole line. Everything not listed above runs immediately.
 */
export function requiresApproval(command: string): boolean {
  const segments = command
    .split(/\|\||&&|[;|\n]/)
    .map(segment => segment.trim().replace(/\s+/g, ' '))
    .filter(Boolean);

  return segments.some(
    segment => NEEDS_APPROVAL.some(pattern => pattern.test(segment)) && !isReadOnlyInvocation(segment),
  );
}
