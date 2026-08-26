import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { getComputerToolConfig, requireComputer, screenshotToResult } from './computer-helpers';
import { emitWorkspaceMetadata } from './helpers';
import { DEFAULT_MAX_MEDIA_BYTES, mediaToModelOutput } from './media';
import { startWorkspaceSpan } from './tracing';

export const computerScreenshotTool = createTool({
  id: WORKSPACE_TOOLS.COMPUTER.SCREENSHOT,
  description:
    'Take a screenshot of the sandbox desktop display. Returns the current screen as an image. Use this to see the desktop state before and after interacting with it.',
  inputSchema: z.object({}),
  execute: async (_input, context) => {
    const { workspace, sandbox, computer } = requireComputer(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.COMPUTER.SCREENSHOT);

    const span = startWorkspaceSpan(context, workspace, {
      category: 'computer',
      operation: 'screenshot',
      attributes: { sandboxProvider: sandbox.provider },
    });

    try {
      const screenshot = await computer.screenshot();
      const config = getComputerToolConfig(workspace, WORKSPACE_TOOLS.COMPUTER.SCREENSHOT);
      const maxMediaBytes = config?.maxMediaBytes ?? DEFAULT_MAX_MEDIA_BYTES;
      const result = screenshotToResult(
        screenshot,
        `Screenshot of the desktop (${screenshot.data.byteLength} bytes, ${screenshot.mediaType})`,
        maxMediaBytes,
      );
      span.end({ success: true }, { bytesTransferred: screenshot.data.byteLength });
      return result;
    } catch (err) {
      span.error(err);
      throw err;
    }
  },
  toModelOutput: mediaToModelOutput,
});
