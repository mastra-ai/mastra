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

export const toTitleCase = (str: string, splitChar = ' ') => {
  return str
    .split(splitChar)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};
