import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { finishComputerAction, requireComputer } from './computer-helpers';
import { emitWorkspaceMetadata } from './helpers';
import { mediaToModelOutput } from './media';
import { startWorkspaceSpan } from './tracing';

export const computerDragTool = createTool({
  id: WORKSPACE_TOOLS.COMPUTER.DRAG,
  description:
    'Drag from one position to another on the sandbox desktop: presses the left button at the start coordinates, moves to the end coordinates, and releases. Use for moving windows, selecting text, and drag-and-drop.',
  inputSchema: z.object({
    startX: z.number().int().min(0).describe('X coordinate to start the drag from'),
    startY: z.number().int().min(0).describe('Y coordinate to start the drag from'),
    endX: z.number().int().min(0).describe('X coordinate to drag to'),
    endY: z.number().int().min(0).describe('Y coordinate to drag to'),
  }),
  execute: async ({ startX, startY, endX, endY }, context) => {
    const { workspace, sandbox, computer } = requireComputer(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.COMPUTER.DRAG);

    const span = startWorkspaceSpan(context, workspace, {
      category: 'computer',
      operation: 'drag',
      input: { startX, startY, endX, endY },
      attributes: { sandboxProvider: sandbox.provider },
    });

    try {
      await computer.drag({ x: startX, y: startY }, { x: endX, y: endY });
      const result = await finishComputerAction(
        workspace,
        computer,
        WORKSPACE_TOOLS.COMPUTER.DRAG,
        `Dragged from (${startX}, ${startY}) to (${endX}, ${endY})`,
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
