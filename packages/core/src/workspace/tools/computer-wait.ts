import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { finishComputerAction, requireComputer } from './computer-helpers';
import { emitWorkspaceMetadata } from './helpers';
import { mediaToModelOutput } from './media';
import { startWorkspaceSpan } from './tracing';

export const computerWaitTool = createTool({
  id: WORKSPACE_TOOLS.COMPUTER.WAIT,
  description:
    'Wait for the sandbox desktop UI to settle (e.g. an application launching or a page loading) before the next action.',
  inputSchema: z.object({
    seconds: z.number().min(0.1).max(30).describe('How long to wait, in seconds (max 30)'),
  }),
  execute: async ({ seconds }, context) => {
    const { workspace, sandbox, computer } = requireComputer(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.COMPUTER.WAIT);

    const span = startWorkspaceSpan(context, workspace, {
      category: 'computer',
      operation: 'wait',
      input: { seconds },
      attributes: { sandboxProvider: sandbox.provider },
    });

    try {
      await new Promise(resolve => setTimeout(resolve, seconds * 1000));
      const result = await finishComputerAction(
        workspace,
        computer,
        WORKSPACE_TOOLS.COMPUTER.WAIT,
        `Waited ${seconds}s`,
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
