/**
 * Regenerates src/integrations/slack/emoji-shortcodes.generated.ts from
 * iamcal/emoji-data — the shortcode list Slack itself ships, which differs from
 * GitHub's (`flag-fr` and `skin-tone-3` exist there, `fr` does not).
 */
import { writeFileSync } from 'node:fs';

// Pinned, not `master`: refreshing the table is a deliberate bump of this sha,
// reviewed as a diff, rather than whatever upstream happens to hold that day.
const SOURCE_COMMIT = '097705020bcf82331c9ef10df3425aad15f5043c';
const SOURCE_URL = `https://raw.githubusercontent.com/iamcal/emoji-data/${SOURCE_COMMIT}/emoji.json`;
const OUTPUT_PATH = new URL('../src/integrations/slack/emoji-shortcodes.generated.ts', import.meta.url);

const charFromUnified = unified =>
  unified
    .split('-')
    .map(hex => String.fromCodePoint(Number.parseInt(hex, 16)))
    .join('');

// JSON.stringify rather than wrapping in quotes: the source is remote data, and
// a name or character carrying a quote would otherwise emit broken TypeScript.
const literal = value => JSON.stringify(value);
const key = name => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : literal(name));

const response = await fetch(SOURCE_URL);
if (!response.ok) throw new Error(`${SOURCE_URL} responded ${response.status}`);

const entries = [];
for (const emoji of await response.json()) {
  for (const shortcode of emoji.short_names) {
    entries.push(`  ${key(shortcode)}: ${literal(charFromUnified(emoji.unified))},`);
  }
}

writeFileSync(
  OUTPUT_PATH,
  [
    '/**',
    ' * AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY',
    ' *',
    ` * Source: ${SOURCE_URL}`,
    ' * Regenerate: node scripts/generate-slack-emoji.mjs (from mastracode/factory)',
    ' */',
    '',
    'export const emojiByShortcode: Record<string, string> = {',
    ...entries,
    '};',
    '',
  ].join('\n'),
);

console.log(`wrote ${entries.length} shortcodes`);
