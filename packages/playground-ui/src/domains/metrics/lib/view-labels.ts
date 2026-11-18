/** "agent" → "agents", "entity" → "entities", "box" → "boxes"; a word already ending in "s" ("teams") stays. */
const plural = (word: string) => {
  if (/s$/i.test(word)) return word;
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(x|z|ch|sh)$/i.test(word)) return `${word}es`;
  return `${word}s`;
};

/** How many leading words every label shares, leaving each at least one word of its own. */
function sharedWords(words: readonly string[][]): number {
  const [first = []] = words;
  let shared = 0;
  while (words.length > 1 && words.every(w => w.length > shared + 1 && w[shared] === first[shared])) shared++;
  return shared;
}

/**
 * Short tab names for a card's views: their labels without the words they all start with,
 * capitalised ("Breakdown by agent", "Breakdown by tool" → "Agents", "Tools"; after "by", the
 * rest names what each row is, so it reads as a plural). Labels that share nothing, or that would
 * shorten to the same name, stay as they are.
 */
export function shortViewLabels(labels: readonly string[]): string[] {
  const words = labels.map(label => label.split(/\s+/));
  const shared = sharedWords(words);
  if (shared === 0) return [...labels];
  const byRows = words[0]?.[shared - 1]?.toLowerCase() === 'by';
  const names = words.map(w => {
    const rest = w.slice(shared);
    const last = rest.pop() ?? '';
    const name = [...rest, byRows ? plural(last) : last].join(' ');
    return name.charAt(0).toUpperCase() + name.slice(1);
  });
  // Two views that shorten to the same name ("by team", "by teams") keep their labels, to tell apart.
  return new Set(names).size === names.length ? names : [...labels];
}
