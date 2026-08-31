// A skill Circle publishes, that Mastra will not load, and the smallest thing that changes that.
//
// The Agent Skills specification caps a skill's `description` at 1024 characters, and Mastra
// enforces it: a skill over the limit is not trimmed but rejected, and a rejected skill is not in
// the catalogue at all. Circle's `pay-via-agent-wallet` is 1128 characters, so on a released
// Mastra the one skill that tells this agent how to pay is the one skill missing from it — the
// other sixteen load, and the failure reads as the model choosing not to use a skill that was
// never offered.
//
// A description is not decoration. It is all a model sees before deciding whether to open a skill,
// which is why authors write trigger phrases into it and why published ones run long. Losing the
// whole skill over its length is the wrong trade in both directions, so this makes the smaller one:
// the description is shortened on the way in, and the skill loads.
//
// Nothing is written back. `~/.agents/skills` is shared with every other agent on the machine and
// `circle skill update` owns what is in it, so this shortens the copy Mastra parses and leaves the
// file alone.
//
// This module is a stopgap with an expiry date. When Mastra's limit rises to 2048, delete it and
// pass the skills path straight to the workspace again.

import matter from 'gray-matter';

import { LocalSkillSource } from '@mastra/core/workspace';
import type { SkillSource, SkillSourceEntry, SkillSourceStat } from '@mastra/core/workspace';

/**
 * The limit skills are rejected for exceeding.
 *
 * Hard-coded rather than imported: `SKILL_LIMITS` is declared in Mastra's types but is not among
 * its runtime exports, so importing it would typecheck and then fail to link.
 */
const MAX_DESCRIPTION_LENGTH = 1024;

/** What stands in for the sentences that were dropped. */
const ELISION = '[…]';

/**
 * Shorten a description to fit, taking sentences from the middle.
 *
 * The ends are the parts worth keeping: a description opens by saying what the skill is for, and
 * closes with the trigger phrases a model matches against. What sits between them is usually
 * examples — the part a reader can lose and still route correctly. So sentences come out of the
 * middle, one at a time, until the rest fits.
 *
 * Truncation at the limit would do the opposite, taking the triggers and leaving the examples.
 */
function shorten(description: string): string {
  const sentences = description.split(/(?<=\.)\s+/);
  const kept = [...sentences];
  while (kept.length > 2 && kept.join(' ').length + ELISION.length + 2 > MAX_DESCRIPTION_LENGTH) {
    kept.splice(Math.ceil(kept.length / 2) - 1, 1);
  }

  const half = Math.ceil(kept.length / 2);
  const joined =
    kept.length < sentences.length
      ? `${kept.slice(0, half).join(' ')} ${ELISION} ${kept.slice(half).join(' ')}`
      : kept.join(' ');

  // A description written as one very long sentence never enters the loop above, so it is cut.
  return joined.length > MAX_DESCRIPTION_LENGTH ? `${joined.slice(0, MAX_DESCRIPTION_LENGTH - 1)}…` : joined;
}

/**
 * Rewrite a `SKILL.md` whose description is too long, and return every other one unchanged.
 *
 * Parsed and re-emitted with a YAML library rather than patched with a regular expression, because
 * the field is a quoted scalar with escapes inside it — Circle's runs to embedded quotation marks —
 * and a regular expression that captures it captures the escaping too.
 */
export function clampSkillDescription(skillMd: string): string {
  try {
    const parsed = matter(skillMd);
    const description = parsed.data?.description;
    if (typeof description !== 'string' || description.length <= MAX_DESCRIPTION_LENGTH) return skillMd;
    return matter.stringify(parsed.content, { ...parsed.data, description: shorten(description) });
  } catch {
    // A skill whose front matter will not parse is not this function's to report. Handing back the
    // original leaves Mastra to fail on it exactly as it would have without this source in the way,
    // so a broken skill in the user's own directory reads the same as it always did.
    return skillMd;
  }
}

/**
 * Reads skills from disk exactly as Mastra would, with over-long descriptions shortened in passing.
 *
 * A `SkillSource` is the seam Mastra leaves for reading skills from somewhere other than the local
 * filesystem. This is still the local filesystem — every method below is the built-in one — with a
 * single file's contents rewritten on the way past.
 */
export class ClampedSkillSource implements SkillSource {
  readonly #source = new LocalSkillSource();

  exists(path: string): Promise<boolean> {
    return this.#source.exists(path);
  }

  stat(path: string): Promise<SkillSourceStat> {
    return this.#source.stat(path);
  }

  readdir(path: string): Promise<SkillSourceEntry[]> {
    return this.#source.readdir(path);
  }

  realpath(path: string): Promise<string> {
    return this.#source.realpath ? this.#source.realpath(path) : Promise.resolve(path);
  }

  async readFile(path: string): Promise<string | Buffer> {
    const contents = await this.#source.readFile(path);
    // Only the manifest carries the description; references and scripts pass through untouched.
    if (!path.endsWith('SKILL.md')) return contents;
    return clampSkillDescription(contents.toString());
  }
}
