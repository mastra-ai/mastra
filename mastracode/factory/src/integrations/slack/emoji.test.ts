import { describe, expect, it } from 'vitest';

import { resolveEmojiShortcodes } from './emoji.js';

describe('resolveEmojiShortcodes', () => {
  it('resolves the names Slack ships, including the ones GitHub has no shortcode for', () => {
    expect(resolveEmojiShortcodes('shipping from :flag-fr: with :the_horns:')).toBe('shipping from 🇫🇷 with 🤘');
  });

  it('leaves a clock time alone, though its digits look like a shortcode', () => {
    expect(resolveEmojiShortcodes('standup at 10:30:00')).toBe('standup at 10:30:00');
  });

  it('leaves a name that collides with an object property alone', () => {
    expect(resolveEmojiShortcodes('the :constructor: and :__proto__: of it')).toBe(
      'the :constructor: and :__proto__: of it',
    );
  });
});
