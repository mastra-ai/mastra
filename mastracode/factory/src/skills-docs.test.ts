import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const docsSkillsPage = fileURLToPath(
  new URL('../../../docs/src/content/en/docs/factory/skills.mdx', import.meta.url),
);
const workspaceSource = fileURLToPath(new URL('./workspace.ts', import.meta.url));

const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The docs page ../../../docs/src/content/en/docs/factory/skills.mdx must
 * never silently drift from FACTORY_SKILL_NAMES, the reserved set users are
 * told about. The page's "Reserved skill names" section lists exactly those
 * names as standalone code-span bullets; extraction here mirrors that shape.
 */
function documentedReservedSkillNames(): Set<string> {
  const page = readFileSync(docsSkillsPage, 'utf8');
  return new Set(
    [...page.matchAll(/^-\s+`([a-z0-9]+(?:-[a-z0-9]+)*)`\s*$/gm)].map(match => match[1]!),
  );
}

function sourceReservedSkillNames(): Set<string> {
  const source = readFileSync(workspaceSource, 'utf8');
  const match = source.match(/FACTORY_SKILL_NAMES\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
  expect(match, 'FACTORY_SKILL_NAMES must remain a literal Set in workspace.ts').toBeTruthy();
  return new Set([...match![1]!.matchAll(/'([a-z0-9]+(?:-[a-z0-9]+)*)'/g)].map(entry => entry[1]!));
}

describe('Factory skills documentation', () => {
  it('keeps the documented reserved skill names in sync with FACTORY_SKILL_NAMES', () => {
    const documented = documentedReservedSkillNames();
    const factorySkillNames = sourceReservedSkillNames();
    expect(documented.size, 'reserved skill names must be listed once each in the docs').toBe(
      factorySkillNames.size,
    );
    for (const reserved of factorySkillNames) {
      expect(documented, `reserved skill ${reserved} must be listed in the docs`).toContain(reserved);
    }
    for (const entry of documented) {
      expect(SKILL_NAME_RE.test(entry), `documented skill ${entry} is not a valid skill name`).toBe(true);
      expect(factorySkillNames, `documented skill ${entry} is no longer reserved`).toContain(entry);
    }
  });
});
