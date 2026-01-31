import Handlebars from 'handlebars';

type HbsNode = {
  type: string;
  path?: { original?: string };
  name?: { original?: string };
  body?: HbsNode[];
  program?: { body?: HbsNode[] };
  inverse?: { body?: HbsNode[] };
};

// Built-in helpers that should not be treated as variables
const BUILT_IN_HELPERS = new Set(['if', 'unless', 'each', 'with', 'lookup', 'log']);

// --- Variable extraction ({{variableName}}) ---

function collectVariableNames(nodes: HbsNode[], result: Set<string>): void {
  for (const node of nodes) {
    // MustacheStatement: {{variableName}}
    if (node.type === 'MustacheStatement' && node.path?.original) {
      const name = node.path.original;
      if (!BUILT_IN_HELPERS.has(name)) {
        result.add(name);
      }
    }

    // BlockStatement path: {{#each items}}
    if (node.type === 'BlockStatement' && node.path?.original) {
      const name = node.path.original;
      if (!BUILT_IN_HELPERS.has(name)) {
        result.add(name);
      }
    }

    // Recurse into nested blocks
    if (node.program?.body) {
      collectVariableNames(node.program.body, result);
    }
    if (node.inverse?.body) {
      collectVariableNames(node.inverse.body, result);
    }
  }
}

export function extractVariableNames(instructions: string): string[] {
  if (!instructions) return [];

  try {
    const ast = Handlebars.parse(instructions);
    const variableNames = new Set<string>();
    collectVariableNames(ast.body as HbsNode[], variableNames);
    return [...variableNames];
  } catch {
    return [];
  }
}

// --- Partial extraction ({{> partialName}}) ---

function collectPartialNames(nodes: HbsNode[], result: Set<string>): void {
  for (const node of nodes) {
    if (node.type === 'PartialStatement' && node.name?.original) {
      result.add(node.name.original);
    }
    // Recurse into block statements (if/each/with/etc.)
    if (node.program?.body) {
      collectPartialNames(node.program.body, result);
    }
    if (node.inverse?.body) {
      collectPartialNames(node.inverse.body, result);
    }
  }
}

export function extractPartialNames(instructions: string): string[] {
  if (!instructions) return [];

  try {
    const ast = Handlebars.parse(instructions);
    const partialNames = new Set<string>();
    collectPartialNames(ast.body as HbsNode[], partialNames);
    return [...partialNames];
  } catch {
    // If parsing fails, return empty array
    return [];
  }
}
