import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import type { AccessibilityNode, AccessibilitySnapshot } from '../sandbox';
import { finishComputerAction, requireComputerAccessibility } from './computer-helpers';
import { emitWorkspaceMetadata } from './helpers';
import { mediaToModelOutput } from './media';
import { startWorkspaceSpan } from './tracing';

function formatNode(node: AccessibilityNode): string {
  const parts = [node.ref, node.role, JSON.stringify(node.name)];
  if (node.value !== undefined) parts.push(`value=${JSON.stringify(node.value)}`);
  if (node.states.length) parts.push(`states=[${node.states.join(',')}]`);
  if (node.actions.length) parts.push(`actions=[${node.actions.join(',')}]`);
  if (node.bounds) {
    const { x, y, width, height } = node.bounds;
    parts.push(`bounds=${x},${y},${width}x${height}`);
  }
  return `${'  '.repeat(node.depth)}${parts.join(' ')}`;
}

function formatSnapshot(snapshot: AccessibilitySnapshot): string {
  const lines = [`snapshotId: ${snapshot.snapshotId}`, ...snapshot.nodes.map(formatNode)];
  if (snapshot.nodes.length === 0) lines.push('(no accessible applications)');
  if (snapshot.truncated) {
    lines.push('(truncated: raise maxDepth/maxNodes or filter by app to see more)');
  }
  return lines.join('\n');
}

export const computerAccessibilityTreeTool = createTool({
  id: WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_TREE,
  description:
    'Read the accessibility tree of the sandbox desktop: one line per control with its ref, role, quoted name, value, states, actions and screen bounds. Refs are valid only for this read; pass them to the accessibility act / set-text tools. Prefer this over screenshots to find and operate controls.',
  inputSchema: z.object({
    app: z.string().max(256).optional().describe('Only include the application with this name'),
    maxDepth: z.number().int().min(1).max(40).default(25).describe('Maximum tree depth to read'),
    maxNodes: z.number().int().min(1).max(2000).default(400).describe('Maximum number of nodes to return'),
  }),
  execute: async ({ app, maxDepth, maxNodes }, context) => {
    const { workspace, sandbox, computer, accessibility } = requireComputerAccessibility(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_TREE);

    const span = startWorkspaceSpan(context, workspace, {
      category: 'computer',
      operation: 'accessibility_tree',
      input: { app, maxDepth, maxNodes },
      attributes: { sandboxProvider: sandbox.provider },
    });

    try {
      const snapshot = await accessibility.getTree({ ...(app !== undefined && { app }), maxDepth, maxNodes });
      const result = await finishComputerAction(
        workspace,
        computer,
        WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_TREE,
        formatSnapshot(snapshot),
        false,
      );
      span.end({ success: true });
      return result;
    } catch (err) {
      span.error(err);
      throw err;
    }
  },
  toModelOutput: mediaToModelOutput,
});
