// Sandbox commands run in a PTY, so CLIs emit color escapes even under NO_COLOR.
// eslint-disable-next-line no-control-regex
const ANSI_RE =
  /[\u001b\u009b][[\]()#;?]*(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\u0007|(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~])/g;

// The same sequences once JSON.stringify escaped the bytes; an even backslash run before the `u` is source text spelling the escape, kept.
const ESCAPED_ANSI_RE = /(?<!\\)((?:\\\\)*)\\u001[bB](?:\[[0-9;?<=>]*[a-zA-Z]|\][\s\S]*?(?:\\u0007|\\u001[bB]\\\\))/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, '');
}

export function stripSerializedAnsi(text: string): string {
  return stripAnsi(text).replace(ESCAPED_ANSI_RE, '$1');
}
