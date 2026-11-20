const maxPolicyCharacters = 800;

export function requiredPolicyContentIssue(body: string): string | undefined {
  if (body.length > maxPolicyCharacters) return `Rendered body exceeds the ${maxPolicyCharacters}-character limit`;

  // Seed attribution, headings, and links alone cannot satisfy a mandatory policy.
  const text = body
    .replace(/<!--[\s\S]*?-->|\[\[[\s\S]*?\]\]|^Source:.*$/gmu, '')
    .replace(/^#.*$/gmu, '')
    .trim();
  const words = text.toLowerCase().match(/[a-z]{2,}/gu) ?? [];
  if (text.length < 40 || words.length < 6 || new Set(words).size < 4 || !/[a-z]{3}/iu.test(text))
    return 'Expected substantive policy instructions after removing headings, links, and attribution';
}
