import { emojiByShortcode } from './emoji-shortcodes.generated.js';

const EMOJI_SHORTCODE = /:([a-z0-9_+-]+):/g;

/** Custom workspace emoji are images with no unicode char, so an unknown name keeps its colons. */
export function resolveEmojiShortcodes(text: string): string {
  return text.replace(EMOJI_SHORTCODE, (shortcode, name: string) => emojiByShortcode[name] ?? shortcode);
}
