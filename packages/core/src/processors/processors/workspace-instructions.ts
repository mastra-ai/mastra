/**
 * WorkspaceInstructionsProcessor - Injects workspace instructions into agent system messages.
 *
 * This processor uses `workspace.getAgentInstructions()` to inject comprehensive
 * workspace guidelines into the agent's system prompt, including:
 * - General tool behavior guidelines
 * - Workspace context (filesystem/sandbox provider info)
 * - Cross-tool workflow guidance
 * - Safety guidelines for destructive operations
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
 *   inputProcessors: [new WorkspaceInstructionsProcessor({ workspace })],
 * });
 * ```
 */

import type { Workspace } from '../../workspace/workspace';
import type { ProcessInputStepArgs, Processor } from '../index';

// =============================================================================
// Configuration
// =============================================================================

/**
 * Configuration options for WorkspaceInstructionsProcessor
 */
export interface WorkspaceInstructionsProcessorOptions {
  /**
   * Workspace instance to generate instructions for.
   */
  workspace: Workspace;
}

// =============================================================================
// WorkspaceInstructionsProcessor
// =============================================================================

/**
 * Processor that injects workspace instructions into agent system messages.
 * Instructions are dynamically built by the workspace based on configuration.
 */
export class WorkspaceInstructionsProcessor implements Processor<'workspace-instructions-processor'> {
  readonly id = 'workspace-instructions-processor' as const;
  readonly name = 'Workspace Instructions Processor';

  private readonly _workspace: Workspace;

  constructor(opts: WorkspaceInstructionsProcessorOptions) {
    this._workspace = opts.workspace;
  }

  /**
   * Process input step - inject workspace instructions.
   * Injected on every step since system message changes from processors are reverted between steps.
   */
  async processInputStep({ messageList, tools }: ProcessInputStepArgs) {
    // Check if workspace has any enabled tools
    const enabledTools = this._workspace.getEnabledTools();

    if (enabledTools.length > 0) {
      const instructions = this._workspace.getAgentInstructions();
      if (instructions) {
        messageList.addSystem({
          role: 'system',
          content: instructions,
        });
      }
    }

    return {
      messageList,
      tools,
    };
  }
}
