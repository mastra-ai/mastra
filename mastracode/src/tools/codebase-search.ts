/**
 * Codebase search tool — delegates semantic search to an external API.
 */
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { createTool } from '@mastra/core/tools';
import { execa } from 'execa';
import { z } from 'zod';

import { truncateStringForTokenEstimate } from '../utils/token-estimator.js';
import { assertPathAllowed, getAllowedPathsFromContext } from './utils.js';

const MAX_SEARCH_TOKENS = 4_000;
const MAX_TURNS = 4;
const TURN_TIMEOUT = 15_000;
const API_URL = 'https://api.morphllm.com/v1/chat/completions';
const MODEL = 'morph-warp-grep-v2';

/** Check whether a Morph API key is available in the environment. */
export function hasMorphKey(): boolean {
  return !!process.env.MORPH_API_KEY;
}

/** Generate a flat file tree for the repo using git ls-files. */
async function getRepoFileTree(root: string): Promise<string> {
  const result = await execa('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    reject: false,
    timeout: TURN_TIMEOUT,
    cwd: root,
  });

  if (result.exitCode !== 0) {
    return '(unable to list repo files)';
  }

  const tree = result.stdout || '';
  if (tree.length > 50_000) {
    return tree.slice(0, 50_000) + '\n(file tree truncated)';
  }
  return tree;
}

interface ToolCall {
  name: string;
  args: Record<string, string>;
}

/** Parse tool_call blocks from the assistant response using regex. */
function parseToolCalls(text: string): ToolCall[] {
  const calls: ToolCall[] = [];
  const blockRegex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
  let match;

  while ((match = blockRegex.exec(text)) !== null) {
    const block = match[1]!;
    const nameMatch = block.match(/<name>\s*(.*?)\s*<\/name>/);
    if (!nameMatch) continue;

    const name = nameMatch[1]!;
    const args: Record<string, string> = {};
    const argRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let argMatch;

    while ((argMatch = argRegex.exec(block)) !== null) {
      if (argMatch[1] !== 'name') {
        args[argMatch[1]!] = argMatch[2]!.trim();
      }
    }

    calls.push({ name, args });
  }

  return calls;
}

interface FinishRange {
  filePath: string;
  startLine: number;
  endLine: number;
}

/** Parse finish tool ranges like "path/to/file:10-25". */
function parseFinishRanges(argsText: string): FinishRange[] {
  const ranges: FinishRange[] = [];
  const lines = argsText
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^(.+?):(\d+)-(\d+)$/);
    if (match) {
      ranges.push({
        filePath: match[1]!,
        startLine: parseInt(match[2]!, 10),
        endLine: parseInt(match[3]!, 10),
      });
    }
  }

  return ranges;
}

/** Execute a ripgrep search locally. */
async function executeRipgrep(pattern: string, searchPath: string, root: string): Promise<string> {
  if (pattern.length > 500) return 'Pattern too long';

  const args = ['--line-number', '--no-heading', '--color=never', '--max-count', '50', '--', pattern, searchPath];

  const result = await execa('rg', args, {
    reject: false,
    timeout: TURN_TIMEOUT,
    cwd: root,
  });

  if (result.exitCode === 1) return 'No matches found.';
  if (result.exitCode !== 0) return `ripgrep error: ${result.stderr || 'Unknown error'}`;

  return result.stdout || 'No output.';
}

/** Read a file's contents. */
async function readFileContents(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return `Error reading file: ${msg}`;
  }
}

/** Read directory contents. */
async function readDirectory(dirPath: string): Promise<string> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.map(e => (e.isDirectory() ? `${e.name}/` : e.name)).join('\n');
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return `Error reading directory: ${msg}`;
  }
}

const ALLOWED_TOOLS = new Set(['ripgrep', 'search', 'read_file', 'view', 'readdir', 'list_dir', 'ls', 'finish']);

/** Execute a tool call locally and return the result string. */
async function executeLocalTool(call: ToolCall, root: string, allowedPaths: string[]): Promise<string> {
  if (!ALLOWED_TOOLS.has(call.name)) return `Unknown tool: ${call.name}`;

  switch (call.name) {
    case 'ripgrep':
    case 'search': {
      const pattern = call.args.pattern || call.args.query || '';
      const searchDir = call.args.path ? path.resolve(root, call.args.path) : root;
      assertPathAllowed(searchDir, root, allowedPaths);
      return executeRipgrep(pattern, searchDir, root);
    }
    case 'read_file':
    case 'view': {
      const filePath = path.resolve(root, call.args.path || call.args.file || '');
      assertPathAllowed(filePath, root, allowedPaths);
      return readFileContents(filePath);
    }
    case 'readdir':
    case 'list_dir':
    case 'ls': {
      const dirPath = path.resolve(root, call.args.path || call.args.dir || '.');
      assertPathAllowed(dirPath, root, allowedPaths);
      return readDirectory(dirPath);
    }
    case 'finish':
      // Handled in the main loop
      return '';
    default:
      return `Unknown tool: ${call.name}`;
  }
}

/** Read specified line ranges from files for the finish step. */
async function readFinishRanges(ranges: FinishRange[], root: string, allowedPaths: string[]): Promise<string> {
  const parts: string[] = [];

  for (const range of ranges) {
    const filePath = path.resolve(root, range.filePath);
    assertPathAllowed(filePath, root, allowedPaths);

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n');
      // Line numbers are 1-indexed
      const start = Math.max(0, range.startLine - 1);
      const end = Math.min(lines.length, range.endLine);
      const slice = lines.slice(start, end);
      const numbered = slice.map((line, i) => `${(start + i + 1).toString().padStart(6)}\t${line}`).join('\n');
      parts.push(`## ${range.filePath}:${range.startLine}-${range.endLine}\n${numbered}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      parts.push(`## ${range.filePath}:${range.startLine}-${range.endLine}\nError: ${msg}`);
    }
  }

  return parts.join('\n\n');
}

/** Make a single chat completion request to the Morph API. */
async function chatCompletion(messages: { role: string; content: string }[], apiKey: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TURN_TIMEOUT);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`API returned ${response.status}: ${body}`);
    }

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timeout);
  }
}

/** Create the codebase search tool. */
export function createCodebaseSearchTool(projectRoot?: string) {
  return createTool({
    id: 'codebase_search',
    description: `Search the codebase semantically. Finds relevant code spans across the repository.\n\nUsage notes:\n- Use for complex searches like "find all usages of pattern X" or architectural questions\n- Prefer over grep for semantic understanding of code relationships\n- Returns relevant code spans with file paths and line numbers`,
    inputSchema: z.object({
      query: z.string().describe('Natural language search query describing what to find in the codebase'),
      path: z
        .string()
        .optional()
        .describe('Subdirectory to scope the search to (relative to project root). Defaults to entire repo.'),
    }),
    execute: async (context, toolContext) => {
      try {
        const root = projectRoot || process.cwd();
        const allowedPaths = getAllowedPathsFromContext(toolContext);

        // Validate scoped path if provided
        if (context.path) {
          const scopedPath = path.resolve(root, context.path);
          assertPathAllowed(scopedPath, root, allowedPaths);
        }

        const apiKey = process.env.MORPH_API_KEY;
        if (!apiKey) {
          return {
            content: 'codebase_search requires MORPH_API_KEY to be set. Get one at https://morphllm.com',
            isError: true,
          };
        }

        // Generate repo file tree
        const fileTree = await getRepoFileTree(root);

        // Build initial message with repo structure and search query
        const scopeNote = context.path ? `\nSearch scoped to: ${context.path}` : '';
        const initialMessage = `<repo_structure>\n${fileTree}\n</repo_structure>\n\n<search_string>\n${context.query}${scopeNote}\n</search_string>`;

        const messages: { role: string; content: string }[] = [{ role: 'user', content: initialMessage }];

        let partialResults: string[] = [];

        // Multi-turn loop
        for (let turn = 0; turn < MAX_TURNS; turn++) {
          let response: string;
          try {
            response = await chatCompletion(messages, apiKey);
          } catch (error) {
            // Network error mid-loop — return partial results
            if (partialResults.length > 0) {
              const partial = partialResults.join('\n\n');
              return {
                content: truncateStringForTokenEstimate(
                  `(search interrupted at turn ${turn + 1}, partial results)\n\n${partial}`,
                  MAX_SEARCH_TOKENS,
                  false,
                ),
                isError: false,
              };
            }
            const msg = error instanceof Error ? error.message : 'Unknown error';
            return {
              content: `codebase search API error at turn ${turn + 1}: ${msg}`,
              isError: true,
            };
          }

          if (!response) {
            return {
              content: 'codebase search returned empty response',
              isError: true,
            };
          }

          messages.push({ role: 'assistant', content: response });

          // Parse tool calls from response
          const toolCalls = parseToolCalls(response);

          // Check for finish tool
          const finishCall = toolCalls.find(tc => tc.name === 'finish');
          if (finishCall) {
            const rangesText = finishCall.args.results || finishCall.args.ranges || '';
            const ranges = parseFinishRanges(rangesText);

            if (ranges.length > 0) {
              const result = await readFinishRanges(ranges, root, allowedPaths);
              return {
                content: truncateStringForTokenEstimate(result, MAX_SEARCH_TOKENS, false),
                isError: false,
              };
            }

            // Finish with no ranges — return the response text itself
            const cleaned = response.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '').trim();
            return {
              content: truncateStringForTokenEstimate(cleaned || 'No results found.', MAX_SEARCH_TOKENS, false),
              isError: false,
            };
          }

          // No tool calls and no finish — treat as final answer
          if (toolCalls.length === 0) {
            return {
              content: truncateStringForTokenEstimate(response, MAX_SEARCH_TOKENS, false),
              isError: false,
            };
          }

          // Execute tool calls and build response
          const toolResults: string[] = [];
          for (const call of toolCalls) {
            try {
              const result = await executeLocalTool(call, root, allowedPaths);
              toolResults.push(`<tool_response name="${call.name}">\n${result}\n</tool_response>`);
              // Accumulate as partial results
              if (result && call.name !== 'finish') {
                partialResults.push(result.slice(0, 5_000));
              }
            } catch (error) {
              const msg = error instanceof Error ? error.message : 'Unknown error';
              toolResults.push(`<tool_response name="${call.name}">\nError: ${msg}\n</tool_response>`);
            }
          }

          const toolResponseContent = `<turn>${turn + 1}</turn>\n${toolResults.join('\n')}`;
          messages.push({ role: 'user', content: toolResponseContent });
        }

        // Max turns reached — return partial results if available
        if (partialResults.length > 0) {
          const partial = partialResults.join('\n\n');
          return {
            content: truncateStringForTokenEstimate(
              `(search reached max turns, partial results)\n\n${partial}`,
              MAX_SEARCH_TOKENS,
              false,
            ),
            isError: false,
          };
        }

        return {
          content: 'codebase search reached maximum turns without results',
          isError: true,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: `search failed: ${msg}`,
          isError: true,
        };
      }
    },
  });
}
