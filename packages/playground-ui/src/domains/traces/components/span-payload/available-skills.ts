export interface AvailableSkill {
  name: string;
  description?: string;
}

export interface AvailableSkillsCatalog {
  /** Text the message carries before the catalog. */
  before: string;
  skills: AvailableSkill[];
  /** Text the message carries after the catalog. */
  after: string;
}

const CATALOG = /<available_skills>([\s\S]*?)<\/available_skills>/;
const SKILL = /<skill>([\s\S]*?)<\/skill>/g;

const unescapeXml = (text: string) =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

const field = (skill: string, tag: string) => {
  const value = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(skill)?.[1];
  return value === undefined ? undefined : unescapeXml(value.trim());
};

/**
 * The `<available_skills>` catalog the skills processor injects into a system message
 * (`formatSkillsCatalog` in core, xml format), split from the text around it.
 * `undefined` when the text has no catalog or none of its skills can be read.
 */
export function parseAvailableSkills(text: string): AvailableSkillsCatalog | undefined {
  const match = CATALOG.exec(text);
  if (!match) return undefined;

  const skills: AvailableSkill[] = [];
  for (const [, body = ''] of (match[1] ?? '').matchAll(SKILL)) {
    const name = field(body, 'name');
    if (name) skills.push({ name, description: field(body, 'description') || undefined });
  }
  if (skills.length === 0) return undefined;

  return {
    before: text.slice(0, match.index),
    skills,
    after: text.slice(match.index + match[0].length),
  };
}
