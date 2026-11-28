import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { accessibilityRefSchema } from './computer-accessibility-schemas';
import { finishComputerAction, requireComputerAccessibility, rethrowAccessibilityError } from './computer-helpers';
import { emitWorkspaceMetadata } from './helpers';
import { mediaToModelOutput } from './media';
import { startWorkspaceSpan } from './tracing';

export const computerAccessibilityActTool = createTool({
  id: WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_ACT,
  description:
    'Invoke an accessibility action (one listed in the node\'s actions, e.g. "click") on a control from the latest accessibility tree read. A stale ref is refused; read the tree again.',
  inputSchema: z.object({
    ref: accessibilityRefSchema,
    action: z.string().min(1).max(64).describe("Action name from the node's actions list"),
  }),
  execute: async ({ ref, action }, context) => {
    const { workspace, sandbox, computer, accessibility } = requireComputerAccessibility(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_ACT);

    const span = startWorkspaceSpan(context, workspace, {
      category: 'computer',
      operation: 'accessibility_act',
      input: { ref, action },
      attributes: { sandboxProvider: sandbox.provider },
    });

    try {
      await accessibility.act(ref, action).catch(rethrowAccessibilityError);
      const result = await finishComputerAction(
        workspace,
        computer,
        WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_ACT,
        `Performed ${action} on ${ref}`,
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
