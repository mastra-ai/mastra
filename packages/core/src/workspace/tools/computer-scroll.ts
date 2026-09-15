import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { finishComputerAction, requireComputer } from './computer-helpers';
import { emitWorkspaceMetadata } from './helpers';
import { mediaToModelOutput } from './media';
import { startWorkspaceSpan } from './tracing';

export const computerScrollTool = createTool({
  id: WORKSPACE_TOOLS.COMPUTER.SCROLL,
  description: 'Scroll the sandbox desktop display up or down.',
  inputSchema: z.object({
    direction: z.enum(['up', 'down']).describe('Scroll direction'),
    amount: z.number().int().min(1).optional().describe('Scroll amount in ticks (default: 3)'),
  }),
  execute: async ({ direction, amount }, context) => {
    const { workspace, sandbox, computer } = requireComputer(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.COMPUTER.SCROLL);

    const effectiveAmount = amount ?? 3;
    const span = startWorkspaceSpan(context, workspace, {
      category: 'computer',
      operation: 'scroll',
      input: { direction, amount: effectiveAmount },
      attributes: { sandboxProvider: sandbox.provider },
    });

    try {
      await computer.scroll(direction, effectiveAmount);
      const result = await finishComputerAction(
        workspace,
        computer,
        WORKSPACE_TOOLS.COMPUTER.SCROLL,
        `Scrolled ${direction} by ${effectiveAmount}`,
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
