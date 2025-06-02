/**
 * Formats a string by replacing placeholders with values from the provided parameters.
 * @param str The string to format.
 * @param params A record of placeholder names to their corresponding values.
 * @returns The formatted string.
 */
export function format(str: string, params: Record<string, string>) {
  return str.replace(/{(\w+)}/g, (_, k) => params[k] ?? '');
}
