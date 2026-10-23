export const lodashTitleCase = (str: string): string => {
  // First convert to camel case (handles various separators like spaces, hyphens, underscores)
  const camelCased = str
    .replace(/[-_\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''))
    .replace(/^(.)/, char => char.toLowerCase());

  // Then convert to start case (capitalize first letter of each word)
  return camelCased
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

const pluralRules = new Intl.PluralRules('en-US');
const count = new Intl.NumberFormat('en-US');

export function pluralize(amount: number, singular: string, plural = `${singular}s`): string {
  return `${count.format(amount)} ${pluralRules.select(amount) === 'one' ? singular : plural}`;
}
