/**
 * The text field menus use when they ask for text (a pack name, an API key, a path): pi-tui's Input,
 * drawn with the prompt's accent "›" so it reads as the prompt asking a question.
 */
import { Input } from '@earendil-works/pi-tui';

import { theme } from '../theme.js';

/** pi-tui's Input draws a plain "> " (two columns); the "›" takes its place at the same width. */
const INPUT_PROMPT = '> ';

export const PASTE_START = '\x1b[200~';
export const PASTE_END = '\x1b[201~';

/** Text from outside (a paste) without escape codes and other control characters, which would break the row it is drawn in. */
export function stripControls(text: string): string {
  return text
    .replace(/\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)?|[PX^_][^\x1b]*(?:\x1b\\)?)/g, '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, '');
}

export class TextInput extends Input {
  override handleInput(data: string): void {
    const pasted = data.startsWith(PASTE_START) && data.endsWith(PASTE_END);
    super.handleInput(
      pasted ? PASTE_START + stripControls(data.slice(PASTE_START.length, -PASTE_END.length)) + PASTE_END : data,
    );
  }

  override render(width: number): string[] {
    return super
      .render(width)
      .map(line => (line.startsWith(INPUT_PROMPT) ? theme.fg('accent', '› ') + line.slice(INPUT_PROMPT.length) : line));
  }
}
