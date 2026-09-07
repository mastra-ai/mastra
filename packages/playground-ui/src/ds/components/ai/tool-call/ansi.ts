// Sandbox commands run in a PTY, so CLIs emit color escapes even under NO_COLOR.
// eslint-disable-next-line no-control-regex
const ANSI_RE =
  /[\u001b\u009b][[\]()#;?]*(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\u0007|(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~])/g;

// The same CSI and OSC sequences once JSON.stringify has escaped the bytes (`\u001b[1;38m`, `\u001b]0;title\u0007`).
const ESCAPED_ANSI_RE = /\\u001[bB](?:\[[0-9;]*[a-zA-Z]|\][\s\S]*?(?:\\u0007|\\u001[bB]\\\\))/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, '');
}

export function stripSerializedAnsi(text: string): string {
  return stripAnsi(text).replace(ESCAPED_ANSI_RE, '');
}
