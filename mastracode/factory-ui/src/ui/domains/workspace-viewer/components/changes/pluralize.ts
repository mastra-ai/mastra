export function pluralize(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}
