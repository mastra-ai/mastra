/**
 * WorkspaceToolsProcessor - Injects workspace tool usage guidelines into agent system messages.
 *
 * This processor uses `workspace.getAgentInstructions()` to inject comprehensive
 * workspace guidelines into the agent's system prompt, including:
 * - General tool behavior guidelines
 * - Workspace context (filesystem/sandbox provider info)
 * - Tool-specific guidelines based on enabled tools
 *
 * @example
 * ```typescript
 * // Auto-created by Agent when workspace is configured
 * const agent = new Agent({
 *   workspace: new Workspace({
 *     filesystem: new LocalFilesystem({ basePath: './data' }),
 *     sandbox: new LocalSandbox({ workingDirectory: './data' }),
 *   }),
 * });
 *
 * // Or explicit processor control:
 * const agent = new Agent({
 *   workspace,
 *   inputProcessors: [new WorkspaceToolsProcessor({ workspace })],
 * });
 * ```
 */

import type { Workspace } from '../../workspace/workspace';
import type { ProcessInputStepArgs, Processor } from '../index';

// =============================================================================
// Configuration
// =============================================================================

/**
 * Configuration options for WorkspaceToolsProcessor
 */
export interface WorkspaceToolsProcessorOptions {
  /**
   * Workspace instance to generate guidelines for.
   */
  workspace: Workspace;
}

// =============================================================================
// WorkspaceToolsProcessor
// =============================================================================

/**
 * Processor that injects workspace tool usage guidelines into agent system messages.
 * Guidelines are dynamically built by the workspace based on enabled tools.
 */
export class WorkspaceToolsProcessor implements Processor<'workspace-tools-processor'> {
  readonly id = 'workspace-tools-processor' as const;
  readonly name = 'Workspace Tools Processor';

  private readonly _workspace: Workspace;
  private _guidelinesInjected = false;

  constructor(opts: WorkspaceToolsProcessorOptions) {
    this._workspace = opts.workspace;
  }

  /**
   * Process input step - inject workspace tool guidelines on first step only.
   */
  async processInputStep({ messageList, tools, stepNumber }: ProcessInputStepArgs) {
    // Only inject guidelines on first step
    if (stepNumber === 0 && !this._guidelinesInjected) {
      // Check if workspace has any enabled tools
      const enabledTools = this._workspace.getEnabledTools();

      if (enabledTools.length > 0) {
        const instructions = this._workspace.getAgentInstructions();
        if (instructions) {
          messageList.addSystem({
            role: 'system',
            content: instructions,
          });
          this._guidelinesInjected = true;
        }
      }
    }

    return {
      messageList,
      tools,
    };
  }
}
