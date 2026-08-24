// Circle's instructions arrive as documents the agent fetches mid-run, and the shell is the wrong
// pipe to carry them.
//
// A command's output is truncated before the model sees it — the last 200 lines, then a token
// budget weighted towards the end. That is the right shape for a log, where what went wrong is at
// the bottom. It is the wrong shape for a document that opens by telling the agent what to do
// first: `setup.md` is 314 lines and asks for the skill install at line 24, `wallet-pay.md` is
// 27KB of guidance the agent is told to read before it spends. Tailing either returns the closing
// paragraphs and drops the instruction.
//
// So a fetch of one of these documents is answered here instead of in the shell. The document is
// what the model asked for and the whole of it is what it needs, so it is returned whole, and no
// truncation stands between the two. Nothing else is intercepted: this is a narrow answer for a
// known set of documents on one host, not a general-purpose HTTP tool.

/**
 * The documents this serves: Circle's published skill instructions and the index that lists them.
 *
 * Pinned to the exact host and path shape rather than matched loosely, because a hook that returns
 * a body the shell never fetched must not be reachable by anything but the documents it was
 * written for.
 */
const CIRCLE_DOC_URL =
  /^https:\/\/agents\.circle\.com\/(?:skills\/[a-z0-9-]+\.md|\.well-known\/agent-skills\/index\.json)$/;

/** Larger than any document Circle publishes today, and a stop on one that grows without warning. */
const MAX_DOC_BYTES = 96 * 1024;

/** Long enough for a slow network, short enough that the agent is not left waiting on a dead host. */
const FETCH_TIMEOUT_MS = 30_000;

/**
 * The Circle document a command fetches for the model to read, if that is all it does.
 *
 * A command that redirects, pipes or chains is left alone: `curl … -o setup.md` is the agent
 * saving a file, and answering it with a body it never asked to see would leave it reading a file
 * that was never written. Only the plain fetch — the one whose whole purpose is to put the
 * document in front of the model — is served here.
 */
export function circleDocFetched(command: string): string | undefined {
  const single = command.trim();
  if (/[|&;><]|\$\(|`/.test(single)) return undefined;
  if (!/^curl\b/.test(single)) return undefined;
  // `-o` and `-O` write to disk, and `--output` is the same flag spelled out.
  if (/(?:^| )(?:-[a-zA-Z]*[oO]|--output|--remote-name)(?: |$)/.test(single)) return undefined;

  const urls = single.split(/\s+/).filter(word => word.startsWith('http'));
  // One document per command, so a second URL is a command doing something this does not model.
  if (urls.length !== 1) return undefined;
  return CIRCLE_DOC_URL.test(urls[0]!) ? urls[0] : undefined;
}

/**
 * Fetch a Circle document in full.
 *
 * Returns `undefined` rather than an error string when the fetch fails, so the caller can fall
 * back to running the command in the shell. A truncated document beats no document, and a
 * network that fails here may well succeed under `curl`.
 */
export async function readCircleDoc(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) return undefined;
    const body = await response.text();
    if (!body || body.length > MAX_DOC_BYTES) return undefined;
    return body;
  } catch {
    return undefined;
  }
}
