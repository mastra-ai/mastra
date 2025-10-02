/**
 * Truncate text
 * @param str Text to truncate
 * @param limit Limit of characters
 * @returns
 * @example
 * truncateText('hello world', 5)
 * // 'hello...'
 * truncateText('hello world', 20)
 * // 'hello world'
 */
export const truncateText = (str: string, limit: number = 20): string => {
  if (!str) return '';
  if (str.length > limit) {
    return str.slice(0, limit) + '...';
  }
  return str;
};

/**
 * Removes all non-letter characters from the provided string, allowing only
 * English alphabet characters (both uppercase and lowercase) to remain.
 * This function utilizes a regular expression to filter out any characters
 * that are not letters, such as numbers, punctuation marks, spaces, and symbols.
 *
 * @param input The string from which to remove non-letter characters.
 * @returns The modified string containing only letters.
 *
 * @example
 * keepOnlyLetters("Hello123 World!")
 * // Returns: 'HelloWorld'
 *
 * @example
 * keepOnlyLetters("2024 New Year!")
 * // Returns: 'NewYear'
 *
 * @example
 * keepOnlyLetters("Data @ 50% speed!")
 * // Returns: 'Dataspeed'
 */
export const keepOnlyLetters = (input: string): string => {
  // Regular expression to match anything that is not a letter
  const regex = /[^a-zA-Z]/g;
  // Replace all non-letter characters with an empty string
  return input.replace(regex, '');
};

/**
 * Remove HTML tags from text
 * @param html HTML string
 * @returns string
 * @example
 * removeHTMLTagsFromText('<p>hello</p>')
 * // 'hello'
 * removeHTMLTagsFromText('<p>hello</p> <p>world</p>')
 * // 'hello world'
 */
export const removeHTMLTagsFromText = (html: string): string => {
  const regex = /<\/?[a-z]+(?=[\s>])(?:[^>=]|=(?:'[^']*'|"[^"]*"|[^'"\s]*))*\s?\/?>/;
  const htmlText = html.replace(regex, '').replace(/<[^>]*>?/gm, '');
  const text = htmlText.split('&nbsp;'); // remove nbsp
  return text.join(' ');
};

/**
 * Capitalize the first letter of a string
 * @param string A string
 * @returns string
 * @example
 * capitalizeFirstLetter('hello')
 * // 'Hello'
 * capitalizeFirstLetter('hello_world')
 * // 'Hello_World'
 */
export const capitalizeFirstLetter = (str: string): string => {
  if (!str) return '';
  return str
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('_');
};

/**
 * Convert a string to camel case
 * @param str
 * @returns string
 * @example
 * toCamelCase('hello world')
 * // 'helloWorld'
 */
export const toCamelCase = (str: string): string => {
  return str
    .split(' ')
    .map((word, index) => {
      // Convert first word to lower case
      if (index === 0) {
        return word.toLowerCase();
      }
      // Capitalize the first letter of other words
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join('');
};

/**
 * Convert a camelCase to space case
 * @param str
 * @returns string
 * @example
 * toSpaceCase('helloWorld')
 * // 'Hello World'
 */
export const toSpaceCase = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/([A-Z])/g, ' $1') // insert a space before all capital letters
    .replace(/^./, str[0].toUpperCase()); // capitalize the first letter
};

/**
 * Get initials from a sentence
 * @param sentence
 * @returns string
 * @example
 * getInitialsFromSentence('Jude Agboola')
 * // 'JA'
 * getInitialsFromSentence('Howard Lee')
 * // 'HL'
 */
export const getInitialsFromSentence = (sentence: string) => {
  const words = sentence?.split(' ');

  let initials = '';

  for (let i = 0; i < words.length; i++) {
    // if char is not a letter, skip
    if (!words[i].match(/[a-zA-Z]/)) continue;
    // Get the first character of each word and convert it to uppercase
    initials += words[i].charAt(0).toUpperCase();
  }

  return initials;
};

export const capitalizeWord = (str: string): string => {
  if (!str) return '';
  return str.charAt(0).toLocaleUpperCase() + str.slice(1);
};

export const capitalizeWordsInSentence = (sentence: string): string => {
  if (!sentence) return '';
  return sentence
    .split(' ')
    .map(word => capitalizeWord(word))
    .join(' ');
};

export const lowerCaseWord = (str: string): string => {
  return str.toLocaleLowerCase();
};

export const toTitleCase = (str: string, splitChar = ' ') => {
  return str
    .split(splitChar)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export const simplePluralize = (word: string, length: number) => `${word}${length === 1 ? '' : 's'}`;

/**
 * Formats an array of strings into a single string where items are separated by commas,
 * with 'and' before the last item if there are multiple items.
 *
 * @param {string[]} items - The array of strings to format.
 * @returns {string} The formatted string.
 * @example
 * // returns 'apple'
 * formatListWithCommasAndAnd(['apple']);
 *
 * @example
 * // returns 'apple and orange'
 * formatListWithCommasAndAnd(['apple', 'orange']);
 *
 * @example
 * // returns 'apple, orange, and banana'
 * formatListWithCommasAndAnd(['apple', 'orange', 'banana']);
 */
