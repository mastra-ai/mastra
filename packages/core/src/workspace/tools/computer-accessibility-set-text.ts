import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { accessibilityRefSchema } from './computer-accessibility-schemas';
import { finishComputerAction, requireComputerAccessibility, rethrowAccessibilityError } from './computer-helpers';
import { emitWorkspaceMetadata } from './helpers';
import { mediaToModelOutput } from './media';
import { startWorkspaceSpan } from './tracing';

export const computerAccessibilitySetTextTool = createTool({
  id: WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_SET_TEXT,
  description:
    'Replace the text of an editable control from the latest accessibility tree read, without using the keyboard. A stale ref is refused; read the tree again.',
  inputSchema: z.object({
    ref: accessibilityRefSchema,
    text: z.string().max(32768).describe('The full new text for the control'),
  }),
  execute: async ({ ref, text }, context) => {
    const { workspace, sandbox, computer, accessibility } = requireComputerAccessibility(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_SET_TEXT);

    const span = startWorkspaceSpan(context, workspace, {
      category: 'computer',
      operation: 'accessibility_set_text',
      input: { ref, length: text.length },
      attributes: { sandboxProvider: sandbox.provider },
    });

    try {
      await accessibility.setText(ref, text).catch(rethrowAccessibilityError);
      const result = await finishComputerAction(
        workspace,
        computer,
        WORKSPACE_TOOLS.COMPUTER.ACCESSIBILITY_SET_TEXT,
        `Set text of ${ref} (${text.length} characters)`,
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
