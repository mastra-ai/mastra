import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { requireComputer } from './computer-helpers';
import { emitWorkspaceMetadata } from './helpers';
import { startWorkspaceSpan } from './tracing';

export const computerGetScreenInfoTool = createTool({
  id: WORKSPACE_TOOLS.COMPUTER.GET_SCREEN_INFO,
  description:
    'Get the sandbox desktop screen dimensions and current mouse cursor position. Use to understand the coordinate space before clicking.',
  inputSchema: z.object({}),
  execute: async (_input, context) => {
    const { workspace, sandbox, computer } = requireComputer(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.COMPUTER.GET_SCREEN_INFO);

    const span = startWorkspaceSpan(context, workspace, {
      category: 'computer',
      operation: 'getScreenInfo',
      attributes: { sandboxProvider: sandbox.provider },
    });

    try {
      const [size, cursor] = await Promise.all([computer.getScreenSize(), computer.getCursorPosition()]);
      span.end({ success: true });
      return `Screen size: ${size.width}x${size.height}\nCursor position: (${cursor.x}, ${cursor.y})`;
    } catch (err) {
      span.error(err);
      throw err;
    }
  },
});
