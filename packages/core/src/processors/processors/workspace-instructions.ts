/**
 * WorkspaceInstructionsProcessor
 *
 * Injects workspace environment instructions (filesystem paths, sandbox info,
 * mount states) into the system message so agents understand which paths are
 * accessible in shell commands vs. file tools.
 *
 * Auto-wired by Agent when a workspace is configured.
 *
 * @example
 * ```typescript
 * // Auto-created by Agent when workspace exists
 * const agent = new Agent({
 *   workspace: new Workspace({
 *     filesystem: new LocalFilesystem({ basePath: './data' }),
 *     sandbox: new LocalSandbox(),
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

import type { AnyWorkspace } from '../../workspace/workspace';
import type { ProcessInputStepArgs, Processor } from '../index';

// =============================================================================
// Configuration
// =============================================================================

/**
 * Configuration options for WorkspaceInstructionsProcessor
 */
export interface WorkspaceInstructionsProcessorOptions {
  /**
   * Workspace instance to derive instructions from.
   */
  workspace: AnyWorkspace;
}

// =============================================================================
// WorkspaceInstructionsProcessor
// =============================================================================

/**
 * Processor that injects workspace environment instructions into the system message.
 */
export class WorkspaceInstructionsProcessor implements Processor<'workspace-instructions-processor'> {
  readonly id = 'workspace-instructions-processor' as const;
  readonly name = 'Workspace Instructions Processor';

  private readonly _workspace: AnyWorkspace;

  constructor(opts: WorkspaceInstructionsProcessorOptions) {
    this._workspace = opts.workspace;
  }

  async processInputStep({ messageList, requestContext }: ProcessInputStepArgs) {
    const instructions = this._workspace.getInstructions({ requestContext });
    if (instructions) {
      messageList.addSystem({ role: 'system', content: instructions });
    }
    return { messageList };
  }
}
