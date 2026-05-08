/**
 * Shared ANSI text-handling helpers for TUI components.
 */

/** Truncate a string with ANSI codes to a visible width.
 *  Handles both SGR sequences (\x1b[...m) and OSC 8 hyperlinks (\x1b]8;...;\x07).
 */
export function truncateAnsi(str: string, maxWidth: number): string {
  // The OSC 8 hyperlink body is terminated by BEL (\x07). We also
  // break on a new ESC (\x1b) so a missing terminator cannot scan
  // unbounded input and amplify polynomial backtracking.
  const ansiRegex = /\x1b\[[0-9;]{0,32}m|\x1b\]8;[^\x07\x1b]{0,8192}\x07/g;
  let visibleLength = 0;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ansiRegex.exec(str)) !== null) {
    // Add text before this ANSI code
    const textBefore = str.slice(lastIndex, match.index);
    const remaining = maxWidth - visibleLength;
    if (textBefore.length <= remaining) {
      result += textBefore;
      visibleLength += textBefore.length;
    } else {
      result += textBefore.slice(0, remaining - 1) + '…';
      result += '\x1b]8;;\x07\x1b[0m'; // Close any open hyperlink + reset styles
      return result;
    }
    // Add the ANSI code (doesn't count toward visible length)
    result += match[0];
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last ANSI code
  const remaining = str.slice(lastIndex);
  const spaceLeft = maxWidth - visibleLength;
  if (remaining.length <= spaceLeft) {
    result += remaining;
  } else {
    result += remaining.slice(0, spaceLeft - 1) + '…';
    result += '\x1b]8;;\x07\x1b[0m'; // Close hyperlink + reset
  }

  return result;
}
