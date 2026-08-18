import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { finishComputerAction, requireComputer } from './computer-helpers';
import { emitWorkspaceMetadata } from './helpers';
import { mediaToModelOutput } from './media';
import { startWorkspaceSpan } from './tracing';

export const computerPressKeyTool = createTool({
  id: WORKSPACE_TOOLS.COMPUTER.PRESS_KEY,
  description:
    'Press a key or key combination on the sandbox desktop keyboard. Pass a single key (e.g. "Enter", "Tab", "Escape") or an array for a hotkey chord (e.g. ["ctrl", "s"]).',
  inputSchema: z.object({
    key: z
      .union([z.string(), z.array(z.string()).min(1)])
      .describe('A single key (e.g. "Enter") or an array of keys pressed together as a hotkey (e.g. ["ctrl", "c"])'),
  }),
  execute: async ({ key }, context) => {
    const { workspace, sandbox, computer } = requireComputer(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.COMPUTER.PRESS_KEY);

    const span = startWorkspaceSpan(context, workspace, {
      category: 'computer',
      operation: 'pressKey',
      input: { key },
      attributes: { sandboxProvider: sandbox.provider },
    });

    try {
      await computer.press(key);
      const label = Array.isArray(key) ? key.join('+') : key;
      const result = await finishComputerAction(
        workspace,
        computer,
        WORKSPACE_TOOLS.COMPUTER.PRESS_KEY,
        `Pressed ${label}`,
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
