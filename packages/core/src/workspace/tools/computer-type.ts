import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { finishComputerAction, requireComputer } from './computer-helpers';
import { emitWorkspaceMetadata } from './helpers';
import { mediaToModelOutput } from './media';
import { startWorkspaceSpan } from './tracing';

export const computerTypeTool = createTool({
  id: WORKSPACE_TOOLS.COMPUTER.TYPE,
  description:
    'Type text into the focused element on the sandbox desktop using the keyboard. Click an input field first to focus it. Use the press-key tool for special keys (Enter, Tab, shortcuts).',
  inputSchema: z.object({
    text: z.string().describe('The text to type'),
  }),
  execute: async ({ text }, context) => {
    const { workspace, sandbox, computer } = requireComputer(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.COMPUTER.TYPE);

    const span = startWorkspaceSpan(context, workspace, {
      category: 'computer',
      operation: 'type',
      input: { length: text.length },
      attributes: { sandboxProvider: sandbox.provider },
    });

    try {
      await computer.type(text);
      const result = await finishComputerAction(
        workspace,
        computer,
        WORKSPACE_TOOLS.COMPUTER.TYPE,
        `Typed ${text.length} characters`,
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
