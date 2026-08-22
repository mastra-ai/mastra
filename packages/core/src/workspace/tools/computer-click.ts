import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { finishComputerAction, requireComputer } from './computer-helpers';
import { emitWorkspaceMetadata } from './helpers';
import { mediaToModelOutput } from './media';
import { startWorkspaceSpan } from './tracing';

export const computerClickTool = createTool({
  id: WORKSPACE_TOOLS.COMPUTER.CLICK,
  description:
    'Left-click at pixel coordinates on the sandbox desktop. Coordinates are measured from the top-left corner of the screen — take a screenshot first to find the right position.',
  inputSchema: z.object({
    x: z.number().int().min(0).describe('X coordinate in pixels from the left edge of the screen'),
    y: z.number().int().min(0).describe('Y coordinate in pixels from the top edge of the screen'),
  }),
  execute: async ({ x, y }, context) => {
    const { workspace, sandbox, computer } = requireComputer(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.COMPUTER.CLICK);

    const span = startWorkspaceSpan(context, workspace, {
      category: 'computer',
      operation: 'click',
      input: { x, y },
      attributes: { sandboxProvider: sandbox.provider },
    });

    try {
      await computer.leftClick(x, y);
      const result = await finishComputerAction(
        workspace,
        computer,
        WORKSPACE_TOOLS.COMPUTER.CLICK,
        `Clicked at (${x}, ${y})`,
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
