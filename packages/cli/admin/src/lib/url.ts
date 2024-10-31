/**
 * @description
 * Checks if a string is a valid URL
 * @param url URL to check
 * @returns
 * @example
 * isValidUrl('https://google.com')
 * // true
 * isValidUrl('google.com')
 * // false
 */
export function isValidUrl(url: string) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * @description
 * Returns a valid URL from a string
 * @param str String to convert to URL
 * @returns
 * @example
 * getUrlFromString('google.com')
 * // 'https://google.com'
 * getUrlFromString('https://google.com')
 * // 'https://google.com'
 */
export function getUrlFromString(str: string) {
  if (isValidUrl(str)) return str;
  try {
    if (str.includes('.') && !str.includes(' ')) {
      return new URL(`https://${str}`).toString();
    }
  } catch (e) {
    return null;
  }
}
