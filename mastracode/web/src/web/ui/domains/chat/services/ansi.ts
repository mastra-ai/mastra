/**
 * Strip ANSI terminal escape sequences from tool output.
 *
 * Sandbox commands run in a PTY, so CLIs like `gh` detect a TTY and emit
 * color/formatting escapes even when NO_COLOR is set. The web transcript
 * renders plain text, so these sequences show up as garbage like `[1;38m`.
 */

// CSI/OSC escape sequences (subset of the well-known ansi-regex pattern).
// eslint-disable-next-line no-control-regex
const ANSI_RE =
  /[\u001b\u009b][[\]()#;?]*(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\u0007|(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~])/g;

// The same sequences after JSON.stringify escapes the ESC byte (`\u001b[1;38m`),
// as seen when a persisted tool result string is re-serialized for display.
const ESCAPED_ANSI_RE = /\\u001[bB]\[[0-9;]*[a-zA-Z]/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, '');
}

/** Strip both raw and JSON-escaped ANSI sequences from serialized text. */
export function stripSerializedAnsi(text: string): string {
  return stripAnsi(text).replace(ESCAPED_ANSI_RE, '');
}
