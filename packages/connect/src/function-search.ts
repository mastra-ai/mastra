import { createTool } from '@mastra/core/tools';
import type { CodeModeStub } from '@mastra/core/tools';
import { z } from 'zod';

type ToolRecord = Record<string, { id: string; description?: string }>;

export const SEARCH_TOOL_ID = 'search_functions';

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 25;

interface Entry {
  stub: CodeModeStub;
  name: Set<string>;
  text: Set<string>;
}

/** Lowercase word list with a light plural strip, so "issues" finds `create_issue`. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(word => (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word));
}

/**
 * Ranks the program's functions for a query. Name words outweigh description
 * words, rare words outweigh common ones (every Linear function says "linear"),
 * and a query term that is a function's exact name always returns it.
 */
function createSearch(tools: ToolRecord, stubs: CodeModeStub[]) {
  const descriptions = new Map(Object.values(tools).map(tool => [tool.id, tool.description ?? '']));
  const entries: Entry[] = stubs.map(stub => {
    const name = new Set(words(stub.externalName));
    return { stub, name, text: new Set([...name, ...words(descriptions.get(stub.toolId) ?? '')]) };
  });
  const frequency = new Map<string, number>();
  for (const entry of entries) for (const word of entry.text) frequency.set(word, (frequency.get(word) ?? 0) + 1);
  const weight = (word: string) => Math.log(1 + entries.length / (frequency.get(word) ?? entries.length));
  const byName = new Map(entries.map(entry => [entry.stub.externalName.toLowerCase(), entry]));

  return (query: string, limit: number): CodeModeStub[] => {
    const exact = query
      .split(/\s+/)
      .map(term =>
        byName.get(
          term
            .toLowerCase()
            .replace(/^external_/, '')
            .replace(/\(.*$/, ''),
        ),
      )
      .filter((entry): entry is Entry => entry !== undefined);
    const terms = [...new Set(words(query))];
    const scored = entries
      .filter(entry => !exact.includes(entry))
      .map(entry => {
        let score = 0;
        for (const term of terms) {
          if (entry.name.has(term)) score += 3 * weight(term);
          else if (entry.text.has(term)) score += 0.5 * weight(term);
          else if (term.length >= 4 && [...entry.name].some(word => word.startsWith(term))) score += 2 * weight(term);
        }
        return { entry, score };
      })
      .filter(({ score }) => score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          // On a tie the more general function (fewer name words) comes first.
          a.entry.name.size - b.entry.name.size ||
          a.entry.stub.externalName.localeCompare(b.entry.stub.externalName),
      );
    return [...new Set([...exact, ...scored.map(({ entry }) => entry)])].slice(0, limit).map(entry => entry.stub);
  };
}

/** The `search_functions` tool: returns declarations for the functions that match a query. */
export function createFunctionSearchTool(tools: ToolRecord, stubs: CodeModeStub[], codeToolId: string) {
  const search = createSearch(tools, stubs);
  return createTool({
    id: SEARCH_TOOL_ID,
    description:
      `Find the external_* functions a \`${codeToolId}\` program can call and get their TypeScript declarations. ` +
      'Search by what you need ("list linear teams") or by exact function names. Call this before writing a ' +
      'program that uses functions you have no declaration for.',
    inputSchema: z.object({
      query: z.string().min(1).describe('What the functions should do, or exact function names separated by spaces.'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(MAX_LIMIT)
        .optional()
        .describe(`How many functions to return (default ${DEFAULT_LIMIT}).`),
    }),
    outputSchema: z.object({ declarations: z.string() }),
    execute: async ({ query, limit }) => {
      const found = search(query, limit ?? DEFAULT_LIMIT);
      return {
        declarations: found.length
          ? found.map(stub => stub.declaration).join('\n\n')
          : 'No functions matched. Try other words, or exact names from the function list in your instructions.',
      };
    },
  });
}

/** Code Mode instructions that list function names only; declarations come from `search_functions`. */
export function searchModeInstructions(stubs: CodeModeStub[], codeToolId: string): string {
  return `# Code Mode

You have access to the \`${codeToolId}\` tool. Instead of calling tools one at a time,
write a single TypeScript program that orchestrates them and returns one result.

There are too many functions to declare here, so only their names are listed
below, without their parameters. Work in two steps:
1. Call the \`${SEARCH_TOOL_ID}\` tool directly (a regular tool call, not from inside a
   program) with what you need, or with exact names from the list. It returns the
   functions' TypeScript declarations.
2. Call \`${codeToolId}\` with a program that only uses functions whose declarations
   you have. Guessed parameters fail validation.

Rules:
- Call the available tools via the \`external_*\` functions. Each returns a
  Promise — \`await\` it.
- Batch independent calls with \`Promise.all\`. Do arithmetic and data shaping in
  JavaScript, not in your head.
- End the program by \`return\`-ing the final value (objects/arrays are fine).
- The only supported capabilities are the \`external_*\` functions. Do not rely
  on filesystem, network, or process access — depending on the configured
  sandbox and transport, the program may run fully isolated with none of those
  available.
- Use \`console.log\` for debugging; logs are captured and returned.

Functions:
${stubs.map(stub => `external_${stub.externalName}`).join('\n')}`;
}
