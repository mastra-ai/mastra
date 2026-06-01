import type { McpMetadata } from '../tools/types';

const DEFAULT_INSTRUCTIONS_MAX_LENGTH = 512;

export function truncateMcpInstructions(instructions: string, maxLength?: number): string {
  const resolvedMaxLength = maxLength ?? DEFAULT_INSTRUCTIONS_MAX_LENGTH;
  if (resolvedMaxLength < 1) {
    return '';
  }

  return instructions.length > resolvedMaxLength ? instructions.slice(0, resolvedMaxLength) : instructions;
}

/**
 * Builds a single markdown string of MCP server guidance from a list of tools.
 *
 * Only tools whose server explicitly opted in (`forwardInstructions === true`)
 * and that advertise non-empty instructions are included. Guidance is
 * deduplicated per server, deterministically ordered by server name, and
 * truncated per server using `instructionsMaxLength`.
 *
 * Returns `undefined` when there is nothing to forward.
 */
export function buildMcpServerGuidance(tools: Array<{ mcpMetadata?: McpMetadata } | undefined>): string | undefined {
  const instructionsByServer = new Map<
    string,
    {
      instructions: string;
      maxLength?: number;
    }
  >();

  for (const tool of tools) {
    const metadata = tool?.mcpMetadata;
    if (!metadata?.serverName || metadata.forwardInstructions !== true) {
      continue;
    }

    const instructions = metadata.serverInstructions?.trim();
    if (!instructions || instructionsByServer.has(metadata.serverName)) {
      continue;
    }

    instructionsByServer.set(metadata.serverName, {
      instructions,
      maxLength: metadata.instructionsMaxLength,
    });
  }

  const guidance = [...instructionsByServer.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([serverName, { instructions, maxLength }]) => {
      const truncatedInstructions = truncateMcpInstructions(instructions, maxLength).trim();
      if (!truncatedInstructions) {
        return undefined;
      }

      return `## Guidance from MCP server "${serverName}"\n\n${truncatedInstructions}`;
    })
    .filter((entry): entry is string => Boolean(entry));

  return guidance.length > 0 ? guidance.join('\n\n') : undefined;
}
