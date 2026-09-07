import { emojiByShortcode } from './emoji-shortcodes.generated.js';

const EMOJI_SHORTCODE = /:([a-z0-9_+-]+):/g;

// A Map, not the object: `:constructor:` matches the pattern, and an object
// lookup would answer with `Object` and coerce it into the message.
const emojiTable = new Map(Object.entries(emojiByShortcode));

/** Custom workspace emoji are images with no unicode char, so an unknown name keeps its colons. */
export function resolveEmojiShortcodes(text: string): string {
  return text.replace(EMOJI_SHORTCODE, (shortcode, name: string) => emojiTable.get(name) ?? shortcode);
}
