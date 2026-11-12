/** The text with any word wider than the circle cut short with an ellipsis, so words never break mid-way. */
export function fitWords(text: string, maxChars: number): string {
  return text
    .split(/(\s+|(?<=:))/)
    .map(word => (word.length > maxChars && !/^\s+$/.test(word) ? `${word.slice(0, maxChars - 1)}\u2026` : word))
    .join('');
}
