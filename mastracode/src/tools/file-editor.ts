import { exec } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { promisify } from 'node:util';
import { distance } from 'fastest-levenshtein';

function removeWhitespace(str: string): string {
  return str
    .replace(/\t/g, '') // tabs to spaces
    .replace(/ +/g, '') // collapse multiple spaces
    .replace(/^ +| +$/gm, '') // trim each line
    .replace(/\r?\n/g, '\n')
    .replace(/\s/g, '');
}

function removeVaryingChars(str: string): string {
  return (
    removeWhitespace(str)
      .replaceAll(`\n`, ``)
      .replaceAll(`'`, ``)
      .replaceAll(`"`, ``)
      .replaceAll('`', ``)
      // .replaceAll(`;`, ``) // this sometimes causes an extra ; to be printed!
      .replaceAll(`\\r`, ``)
  );
}

import {
  SNIPPET_LINES,
  readFile,
  writeFile,
  makeOutput,
  validatePath,
  withFileLock,
  // truncateText
} from './utils';
const realExecAsync = promisify(exec);

interface ViewArgs {
  path: string;
  view_range?: [number, number];
}

interface CreateArgs {
  path: string;
  file_text: string;
}

interface StrReplaceArgs {
  path: string;
  old_str: string;
  new_str: string;
  start_line?: number;
}

interface InsertArgs {
  path: string;
  insert_line: number;
  new_str: string;
}

export class FileEditor {
  private execAsync: typeof realExecAsync;

  constructor() {
    this.execAsync = realExecAsync;
  }

  async view(args: ViewArgs) {
    await validatePath('view', args.path);
    if (await this.isDirectory(args.path)) {
      const { stdout, stderr } = await this.execAsync(`find "${args.path}" -maxdepth 2 -not -path '*/.*'`);
      if (stderr) return stderr;
      return `Here's the files and directories up to 2 levels deep in ${args.path}, excluding hidden items:\n${stdout}\n`;
    }
    const fileContent = await readFile(args.path);
    if (args.view_range) {
      const fileLines = fileContent.split('\n');
      const nLinesFile = fileLines.length;
      const [start] = args.view_range;
      let [, end] = args.view_range;
      if (start < 1 || start > nLinesFile) {
        return `Invalid \`view_range\`: ${args.view_range}. Its first element \`${start}\` should be within the range of lines of the file: [1, ${nLinesFile}]`;
      }
      if (end !== -1) {
        if (end > nLinesFile) {
          end = nLinesFile;
          // throw new ToolError(
          //     `Invalid \`view_range\`: ${args.view_range}. Its second element \`${end}\` should be smaller than the number of lines in the file: \`${nLinesFile}\``
          // );
        }
        if (end < start) {
          return `Invalid \`view_range\`: ${args.view_range}. Its second element \`${end}\` should be larger or equal than its first \`${start}\``;
        }
      }
      const selectedLines = end === -1 ? fileLines.slice(start - 1) : fileLines.slice(start - 1, end);
      return makeOutput(selectedLines.join('\n'), String(args.path), start);
    }
    return makeOutput(fileContent, String(args.path));
  }
  async create(args: CreateArgs) {
    await validatePath('create', args.path);
    await writeFile(args.path, args.file_text);
    return `File created successfully at: ${args.path}`;
  }
  // undoubleEscape(input) {
  //     return input.replace(/("([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`|\/([^\/\\\n]|\\.)+\/[gimsuy]*)|\\n|\\r|\\t|\\"|\\'|\\`/g, (match) => {
  //         if (match.startsWith('"') ||
  //             match.startsWith("'") ||
  //             match.startsWith("`") ||
  //             match.startsWith("/")) {
  //             return match; // skip unescaping inside strings, backticks, or regex literals
  //         }
  //         // outside of those: unescape
  //         return match
  //             .replace(/\\n/g, "\n")
  //             .replace(/\\r/g, "\r")
  //             .replace(/\\t/g, "\t")
  //             .replace(/\\"/g, '"')
  //             .replace(/\\'/g, "'")
  //             .replace(/\\`/g, "`");
  //     });
  // }
  async strReplace(args: StrReplaceArgs) {
    await validatePath('string_replace', args.path);
    if (args.old_str === args.new_str) {
      return `Received the same string for old_str and new_str`;
    }
    // Queue concurrent edits to the same file
    return withFileLock(args.path, async () => {
      const fileContent = await readFile(args.path);
      // First, try exact match with the raw string (no processing)
      // This handles cases where the search/replace should work exactly as provided
      if (fileContent.includes(args.old_str)) {
        // Exact match found! Use simple string replacement
        const processedNewStr = args.new_str || '';
        const newFileContent = fileContent.split(args.old_str).join(processedNewStr);
        await writeFile(args.path, newFileContent);
        return `The file ${args.path} has been edited. `;
      }

      // Try whitespace-normalized exact match before falling back to fuzzy matching
      // This handles cases where the only difference is whitespace/indentation
      // while preserving all escaping (e.g., \\n stays as \\n)
      const normalizeWhitespace = (str: string) => str.replace(/\s+/g, ' ').trim();
      const normalizedOldStr = normalizeWhitespace(args.old_str);
      const normalizedContent = normalizeWhitespace(fileContent);

      if (normalizedContent.includes(normalizedOldStr)) {
        // Find the actual position in the original content by searching for the pattern
        // We need to find where the whitespace-normalized match occurs in the original
        const lines = fileContent.split('\n');
        let bestMatch = { start: -1, end: -1, content: '' };

        // Use original old_str line count (not normalized, which collapses \n)
        const originalOldLineCount = args.old_str.split('\n').length;
        // Allow some slack for whitespace differences
        const maxWindow = originalOldLineCount + 5;
        // Try to find the matching section by comparing normalized versions
        for (let i = 0; i < lines.length; i++) {
          for (let j = i; j <= Math.min(i + maxWindow, lines.length - 1); j++) {
            const candidate = lines.slice(i, j + 1).join('\n');
            if (normalizeWhitespace(candidate) === normalizedOldStr) {
              bestMatch = { start: i, end: j, content: candidate };
              break;
            }
          }
          if (bestMatch.start !== -1) break;
        }
        if (bestMatch.start !== -1) {
          const beforeLines = lines.slice(0, bestMatch.start);
          const afterLines = lines.slice(bestMatch.end + 1);
          const newFileContent = [...beforeLines, args.new_str || '', ...afterLines].join('\n');

          // Save the file
          await writeFile(args.path, newFileContent);

          // Find the line number for the snippet
          const fileLines = newFileContent.split('\n');
          const startLine = Math.max(0, bestMatch.start - SNIPPET_LINES);
          const endLine = Math.min(
            fileLines.length,
            bestMatch.start + SNIPPET_LINES + (args.new_str || '').split('\n').length,
          );
          const snippet = fileLines.slice(startLine, endLine).join('\n');
          let successMsg = `The file ${args.path} has been edited. `;
          successMsg += makeOutput(snippet, `a snippet of ${args.path}`, startLine + 1);
          successMsg += 'Review the changes and make sure they are as expected. Edit the file again if necessary.';
          return successMsg;
        }
      }

      // If exact match and whitespace-normalized match both fail, proceed with fuzzy whitespace-agnostic matching
      // First apply undoubleEscape for the fuzzy matching
      const processedOldStr = args.old_str;
      const processedNewStr = args.new_str || '';
      // Remove leading line numbers and whitespace from each line
      const removeLeadingLineNumbers = (str: string): string => {
        return str
          .split('\n')
          .map(line => line.replace(/^\s*\d+\s*/, ''))
          .join('\n');
      };
      let oldStr = removeLeadingLineNumbers(processedOldStr);
      let newStr = removeLeadingLineNumbers(processedNewStr);
      if (oldStr.startsWith(`\\\n`)) {
        oldStr = oldStr.substring(`\\\n`.length);
      }
      if (newStr.startsWith(`\\\n`)) {
        newStr = newStr.substring(`\\\n`.length);
      }
      const startLineArg =
        typeof args.start_line === `number`
          ? Math.max(args.start_line - 5, 0) // - 3 cause llms are not precise
          : undefined;
      // Split and normalize
      const oldLinesSplit = oldStr.split('\n');
      const oldLinesOriginal = oldLinesSplit.filter((l, i) => {
        if (i === 0) return removeWhitespace(l) !== ``;
        if (i + 1 !== oldLinesSplit.length) return true;
        // only keep last item if it's not an empty string
        return removeWhitespace(l) !== ``;
      });
      const oldLines = oldLinesOriginal.map(removeWhitespace);
      const split = (str: string): string[] => {
        return str.split('\n').map((l: string) => l.replaceAll(`\n`, `\\n`));
      };
      const fileLines = split(fileContent);
      const normFileLines = fileLines.map(removeWhitespace);
      const bestMatch: {
        start: number;
        avgDist: number;
        type: string;
        end?: number;
      } = {
        start: -1,
        avgDist: Infinity,
        type: 'replace-lines',
      };
      const isSingleLineReplacement = oldLines.length === 1;
      const matchLineNumbers = normFileLines
        .map((l: string, index: number) => (l === oldLines[0] ? index + 1 : null))
        .filter(Boolean);
      if (isSingleLineReplacement && matchLineNumbers.length > 1 && !startLineArg) {
        return `Single line search string "${oldLines[0]}" has too many matches. This will result in innacurate replacements. Found ${matchLineNumbers.length} matches. Pass start_line to choose one. Found on lines ${matchLineNumbers.join(`, `)}`;
      }
      let divergedMessage;
      let divergenceAfterX = 0;
      const fileNoSpace = removeVaryingChars(fileContent);
      const oldStringNoSpace = removeVaryingChars(oldStr);
      if (fileNoSpace.includes(oldStringNoSpace.substring(0, -1))) {
        let oldStringNoSpaceBuffer = oldStringNoSpace;
        let startIndex = null;
        let endIndex = null;
        for (const [index, line] of split(fileContent).entries()) {
          if (
            startIndex === null &&
            typeof startLineArg !== `undefined` &&
            index + 1 > startLineArg + 50 // allow for llm to be off by 50 lines lmao
          ) {
            continue;
          }
          if (typeof startLineArg !== `undefined` && index < startLineArg) {
            continue;
          }
          const lineNoSpace = removeVaryingChars(line);
          if (lineNoSpace === `` && !startIndex) continue;
          const startsWith = oldStringNoSpaceBuffer.startsWith(lineNoSpace);
          const startsWithNoDanglingCommaTho =
            !startsWith &&
            lineNoSpace.endsWith(`,`) &&
            oldStringNoSpaceBuffer.substring(lineNoSpace.length - 1).startsWith(`)`) &&
            oldStringNoSpaceBuffer.startsWith(lineNoSpace.substring(0, lineNoSpace.length - 1));
          if (
            startsWith ||
            // allow for missing dangling comma (common in JS/TS, harmless in other languages)
            startsWithNoDanglingCommaTho
          ) {
            if (startIndex === null) {
              startIndex = index;
            }
            oldStringNoSpaceBuffer = oldStringNoSpaceBuffer.substring(
              startsWithNoDanglingCommaTho
                ? lineNoSpace.length - 1 // remove the comma
                : lineNoSpace.length,
            );
            if (oldStringNoSpaceBuffer.length === 0 && startIndex !== null) {
              endIndex = index;
              break;
            }
          } else if (startIndex !== null) {
            // diverged from a partial match. reset
            startIndex = null;
            oldStringNoSpaceBuffer = oldStringNoSpace;
          }
        }
        if (startIndex !== null && endIndex !== null) {
          bestMatch.start = startIndex;
          bestMatch.end = endIndex;
        }
      }
      for (const [index, normLine] of normFileLines.entries()) {
        if (!normLine) continue;
        // we already matched above!
        if (bestMatch.end) break;
        if (typeof startLineArg !== `undefined` && index + 1 < startLineArg) continue;
        // if there's a start line it must match within the next 50 lines
        if (typeof startLineArg !== `undefined` && index + 1 > startLineArg + 50) continue;
        if (typeof startLineArg !== `undefined` && index + 1 > startLineArg + 5 && isSingleLineReplacement) {
          // only break early for single line replacements.. if the llm added a line number to start from + multiple lines to match, often it gets confused about the line numbers, so keep going until the end.
          break;
        }
        // this line is equal to the first line in our from replacement. Lets check each following line to see if we match
        const firstDistance = distance(oldLines[0] || '', normLine || '');
        const firstPercentDiff = (firstDistance / (normLine?.length || 0)) * 100;
        if (isSingleLineReplacement && (normLine === oldLines[0] || normLine.includes(oldLines[0]!))) {
          bestMatch.start = index;
          bestMatch.type = 'replace-in-line';
          continue;
        }
        if (oldLines[0] === normLine || firstPercentDiff < 5) {
          let isMatching = true;
          let matchingLineCount = 0;
          for (const [matchIndex, oldLine] of oldLines.entries()) {
            const innerNormLine = normFileLines[index + matchIndex]!;
            const innerDistance = distance(oldLine, normFileLines[index + matchIndex]!);
            const innerPercentDiff = (innerDistance / innerNormLine.length) * 100;
            const remainingLines = oldLines.length - matchingLineCount;
            const percentLinesRemaining = (remainingLines / oldLines.length) * 100;
            const isMatch = oldLine === innerNormLine || innerPercentDiff < 5;
            const fewLinesAreLeft = oldLines.length >= 30 && percentLinesRemaining < 1;
            if (isMatch || fewLinesAreLeft) {
              matchingLineCount++;
            } else {
              const message = `old_str matching diverged after ${matchingLineCount} matching lines.\nExpected line from old_str: \`${oldLinesOriginal[matchIndex]}\` (line ${matchIndex + 1} in old_str), found line: \`${fileLines[index + matchIndex]}\` (line ${index + 1 + matchIndex} in file). ${remainingLines - 1} lines remained to compare but they were not checked due to this line not matching.\n\nHere are the lines that did match up until the old_str diverged:\n\n${oldLinesOriginal.slice(0, matchIndex).join(`\n`)}\n\nHere are the remaining lines you would've had to provide for the old_str to match:\n\n${fileLines
                .slice(index + matchIndex, index + matchIndex + remainingLines)
                .join(`\n`)}`;
              // tell the llm about the longest matching string so it can adjust the next input
              if (matchingLineCount > divergenceAfterX) {
                divergenceAfterX = matchingLineCount;
                divergedMessage = message;
              }
              isMatching = false;
              break;
            }
          }
          if (isMatching) {
            bestMatch.start = index;
            break;
          }
        }
      }
      if (
        bestMatch.start === -1 &&
        (isSingleLineReplacement || oldStr === `\n`) &&
        newStr === `` &&
        typeof startLineArg === `number`
      ) {
        // we're just deleting a line
        bestMatch.start = startLineArg;
        bestMatch.type = 'delete-line';
      }
      let newFileContent = ``;
      if (bestMatch.start === -1) {
        return `No replacement was performed. No sufficiently close match for old_str found in ${args.path}.
${divergedMessage ? divergedMessage : ``}Try adjusting your input or the file content.`;
      }
      if (bestMatch.type === `replace-lines`) {
        // Replace the original lines in fileLines from bestMatch.start to bestMatch.start + oldLines.length
        const newFileLines = [
          ...fileLines.slice(0, bestMatch.start),
          ...(newStr ? newStr.split('\n') : []),
          ...fileLines.slice(bestMatch.end ? bestMatch.end + 1 : bestMatch.start + oldLines.length),
        ];
        // console.log({ newFileLines });
        newFileContent = newFileLines.join('\n');
        await writeFile(args.path, newFileContent);
      } else if (bestMatch.type === `replace-in-line`) {
        const [firstNew, ...restNew] = newStr ? newStr.split('\n') : [];
        const newFileLines = [
          ...fileLines.slice(0, bestMatch.start),
          ...(restNew?.length
            ? [firstNew, ...restNew]
            : [fileLines.at(bestMatch.start)?.replace(oldLinesOriginal[0]!, firstNew || '') ?? '']),
          ...fileLines.slice(bestMatch.start + 1),
        ];
        newFileContent = newFileLines.join('\n');
        await writeFile(args.path, newFileContent);
      } else if (bestMatch.type === `delete-line`) {
        const newFileLines = [...fileLines.slice(0, bestMatch.start), ...fileLines.slice(bestMatch.start + 1)];
        newFileContent = newFileLines.join('\n');
        await writeFile(args.path, newFileContent);
      }
      // Find the line number for the snippet
      const replacementLine = bestMatch.start + 1;
      const startLine = Math.max(0, replacementLine - SNIPPET_LINES);
      const endLine = replacementLine + SNIPPET_LINES + newStr.split('\n').length;
      const snippet = newFileContent
        .split('\n')
        .slice(startLine, endLine + 1)
        .join('\n');
      let successMsg = `The file ${args.path} has been edited. `;
      successMsg += makeOutput(snippet, `a snippet of ${args.path}`, startLine + 1);
      successMsg += 'Review the changes and make sure they are as expected. Edit the file again if necessary.';
      return successMsg;
    }); // end withFileLock
  }
  async insert(args: InsertArgs) {
    await validatePath('insert', args.path);
    const fileContent = await readFile(args.path);
    const newStr = args.new_str;
    const fileLines = fileContent.split('\n');
    const nLinesFile = fileLines.length;
    if (args.insert_line < 0 || args.insert_line > nLinesFile) {
      return `Invalid \`insert_line\` parameter: ${args.insert_line}. It should be within the range of lines of the file: [0, ${nLinesFile}]`;
    }
    const newStrLines = newStr.split('\n');
    const newFileLines = [
      ...fileLines.slice(0, args.insert_line + 1),
      ...newStrLines,
      ...fileLines.slice(args.insert_line + 1),
    ];
    const snippetLines = [
      ...fileLines.slice(Math.max(0, args.insert_line - SNIPPET_LINES), args.insert_line + 1),
      ...newStrLines,
      ...fileLines.slice(args.insert_line + 1, args.insert_line + SNIPPET_LINES),
    ];
    const newFileContent = newFileLines.join('\n');
    const snippet = snippetLines.join('\n');
    await writeFile(args.path, newFileContent);
    let successMsg = `The file ${args.path} has been edited. `;
    successMsg += makeOutput(
      snippet,
      'a snippet of the edited file',
      Math.max(1, args.insert_line - SNIPPET_LINES + 1),
    );
    successMsg +=
      'Review the changes and make sure they are as expected (correct indentation, no duplicate lines, etc). Edit the file again if necessary.';
    return successMsg;
  }

  async isDirectory(filePath: string) {
    try {
      const stats = await fs.stat(filePath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }
}

// Singleton instance of FileEditor
export const sharedFileEditor = new FileEditor();
