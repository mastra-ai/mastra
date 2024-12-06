export const toCamelCase = (str: string): string => {
  // If string is already camelCase with no spaces, return as is
  if (/^[a-z][a-zA-Z0-9]*$/.test(str) && !str.includes(' ')) {
    return str;
  }

  return str
    .split(' ')
    .filter(word => word.length > 0)
    .map((word, index) => {
      // If word contains hyphen, return as is
      if (word.includes('-')) {
        return word;
      }

      // If word is already camelCase, preserve its case
      if (/^[a-z][a-zA-Z0-9]*$/.test(word)) {
        return index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1);
      }

      // Otherwise convert to camelCase
      return index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.toLowerCase().slice(1);
    })
    .join('');
};
