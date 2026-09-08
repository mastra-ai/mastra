import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { finishComputerAction, requireComputer } from './computer-helpers';
import { emitWorkspaceMetadata } from './helpers';
import { mediaToModelOutput } from './media';
import { startWorkspaceSpan } from './tracing';

export const computerDoubleClickTool = createTool({
  id: WORKSPACE_TOOLS.COMPUTER.DOUBLE_CLICK,
  description:
    'Double-click (left button) at pixel coordinates on the sandbox desktop. Use for opening files, folders, and applications.',
  inputSchema: z.object({
    x: z.number().int().min(0).describe('X coordinate in pixels from the left edge of the screen'),
    y: z.number().int().min(0).describe('Y coordinate in pixels from the top edge of the screen'),
  }),
  execute: async ({ x, y }, context) => {
    const { workspace, sandbox, computer } = requireComputer(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.COMPUTER.DOUBLE_CLICK);

    const span = startWorkspaceSpan(context, workspace, {
      category: 'computer',
      operation: 'doubleClick',
      input: { x, y },
      attributes: { sandboxProvider: sandbox.provider },
    });

    try {
      await computer.doubleClick(x, y);
      const result = await finishComputerAction(
        workspace,
        computer,
        WORKSPACE_TOOLS.COMPUTER.DOUBLE_CLICK,
        `Double-clicked at (${x}, ${y})`,
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
