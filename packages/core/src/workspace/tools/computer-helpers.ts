/**
 * Shared helpers for the workspace computer (desktop) tools.
 *
 * The computer tools delegate to the sandbox's optional `computer` capability
 * (see SandboxComputer). These helpers extract the capability from the tool
 * execution context and format screenshot results as media parts.
 */

import type { ToolExecutionContext } from '../../tools/types';
import { WORKSPACE_TOOLS } from '../constants';
import { SandboxFeatureNotSupportedError } from '../errors';
import type { ComputerScreenshot, SandboxComputer, WorkspaceSandbox } from '../sandbox';
import { supportsComputer } from '../sandbox';
import type { Workspace } from '../workspace';
import { requireSandbox } from './helpers';
import type { MediaToolResult } from './media';
import { DEFAULT_MAX_MEDIA_BYTES } from './media';
import type { ComputerToolConfig } from './types';

/** Default for ComputerToolConfig.screenshotAfterAction. */
export const DEFAULT_SCREENSHOT_AFTER_ACTION = true;

/** Default for ComputerToolConfig.screenshotDelayMs. */
export const DEFAULT_SCREENSHOT_DELAY_MS = 500;

type ComputerToolName = (typeof WORKSPACE_TOOLS.COMPUTER)[keyof typeof WORKSPACE_TOOLS.COMPUTER];

/**
 * Extract the computer capability from the workspace sandbox in the tool
 * execution context. Throws if the workspace has no sandbox or the sandbox
 * doesn't support the computer capability.
 */
export function requireComputer(context: ToolExecutionContext): {
  workspace: Workspace;
  sandbox: WorkspaceSandbox;
  computer: SandboxComputer;
} {
  const { workspace, sandbox } = requireSandbox(context);
  if (!supportsComputer(sandbox)) {
    throw new SandboxFeatureNotSupportedError('computer');
  }
  return { workspace, sandbox, computer: sandbox.computer };
}

/** Resolve the per-tool ComputerToolConfig from the workspace tools config. */
export function getComputerToolConfig(
  workspace: Workspace,
  toolName: ComputerToolName,
): ComputerToolConfig | undefined {
  return workspace.getToolsConfig()?.[toolName];
}

/**
 * Format a screenshot as a MediaToolResult, falling back to text-only output
 * when the image exceeds the configured size cap (so huge base64 payloads
 * don't blow up the model context or storage).
 */
export function screenshotToResult(
  screenshot: ComputerScreenshot,
  text: string,
  maxMediaBytes: number,
): MediaToolResult | string {
  if (screenshot.data.byteLength > maxMediaBytes) {
    return `${text} — screenshot (${screenshot.data.byteLength} bytes, ${screenshot.mediaType}) exceeds maxMediaBytes (${maxMediaBytes}). Returning text only; configure \`maxMediaBytes\` on the computer tool to raise this cap.`;
  }
  return {
    __workspaceMedia: true,
    text,
    mediaType: screenshot.mediaType,
    data: Buffer.from(screenshot.data).toString('base64'),
  };
}

/**
 * Finish a computer action tool: when `screenshotAfterAction` is enabled
 * (default), wait briefly for the UI to react and attach a fresh screenshot
 * to the result so computer-use loops see the resulting desktop state.
 * Screenshot failures never fail the action itself.
 */
export async function finishComputerAction(
  workspace: Workspace,
  computer: SandboxComputer,
  toolName: ComputerToolName,
  text: string,
): Promise<MediaToolResult | string> {
  const config = getComputerToolConfig(workspace, toolName);
  const screenshotAfterAction = config?.screenshotAfterAction ?? DEFAULT_SCREENSHOT_AFTER_ACTION;
  if (!screenshotAfterAction) return text;

  const delayMs = config?.screenshotDelayMs ?? DEFAULT_SCREENSHOT_DELAY_MS;
  if (delayMs > 0) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  try {
    const screenshot = await computer.screenshot();
    const maxMediaBytes = config?.maxMediaBytes ?? DEFAULT_MAX_MEDIA_BYTES;
    return screenshotToResult(screenshot, text, maxMediaBytes);
  } catch {
    return `${text} (post-action screenshot failed)`;
  }
}
