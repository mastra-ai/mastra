/**
 * Sanitizes error messages before they are sent to analytics.
 *
 * Failure telemetry reports `error.message`, and several failure paths embed
 * user-supplied input in their messages: a clone failure includes the full
 * `git clone <url>` command (a custom template URL can identify a private repo
 * and may carry embedded credentials), and `--region`/`--org` validation
 * errors echo the raw flag value back. The user still sees the original
 * message on stderr — only the analytics copy is redacted.
 */

const REDACTED = '[redacted]';

/** Strips `user:password@` credentials from any URL in the message. */
function stripUrlCredentials(message: string): string {
  return message.replace(/\/\/[^\s/@]+@/g, `//${REDACTED}@`);
}

/**
 * A value can surface in messages in derived forms: without embedded
 * credentials (git may omit them when echoing the URL) or with the
 * `https://github.com/` prefix stripped (degit's repo shorthand).
 */
function variantsOf(value: string): string[] {
  // Remove (not mark) the userinfo so the variant matches how git/degit echo
  // the URL without credentials.
  const variants = new Set([value, value.replace(/\/\/[^\s/@]+@/g, '//')]);
  for (const variant of [...variants]) {
    if (variant.startsWith('https://github.com/')) {
      variants.add(variant.slice('https://github.com/'.length));
    }
  }
  return [...variants];
}

/**
 * Redacts every literal occurrence (and derived variant) of the provided
 * user-supplied values, any URL credentials, and the org list echoed by
 * `--org` mismatch errors.
 */
export function redactErrorMessage(message: string, sensitiveValues: Array<string | undefined> = []): string {
  let redacted = message;
  // Literal values first: stripping credentials afterwards would otherwise
  // mutate a credentialed URL so its literal no longer matches.
  for (const value of sensitiveValues) {
    if (!value) continue;
    for (const variant of variantsOf(value)) {
      redacted = redacted.split(variant).join(REDACTED);
    }
  }
  redacted = stripUrlCredentials(redacted);
  // The `--org` mismatch error enumerates the account's organizations
  // ("Available: name (id), ..."), which are not user-supplied and can't be
  // matched by value — drop the list wholesale.
  redacted = redacted.replace(/Available: .*$/s, `Available: ${REDACTED}.`);
  return redacted;
}

/** Returns a copy of `error` safe to report to analytics. */
export function redactError(error: unknown, sensitiveValues: Array<string | undefined> = []): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(redactErrorMessage(message, sensitiveValues));
}
