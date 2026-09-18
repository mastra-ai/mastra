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

import { SpanType } from '../../observability';
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

  /**
   * Trace this as a workspace action rather than an anonymous processor run:
   * the user configured a `workspace`, not a processor, so the span should name
   * the subsystem the injected instructions describe.
   *
   * `mount` is the right category — the instructions exist to tell the model
   * which paths are reachable through shell commands versus file tools, which
   * is mount state. The processor is only wired when the workspace has a
   * filesystem or sandbox, so there is always a workspace to attribute it to.
   */
  readonly spanType = SpanType.WORKSPACE_ACTION;
  readonly spanName = 'workspace:mount:instructions';
  readonly spanAttributes = { category: 'mount' } as const;

  private readonly _workspace: AnyWorkspace;

  constructor(opts: WorkspaceInstructionsProcessorOptions) {
    this._workspace = opts.workspace;
  }

  async processInputStep({ messageList, requestContext, tracingContext }: ProcessInputStepArgs) {
    const instructions =
      typeof this._workspace.getInstructionsAsync === 'function'
        ? await this._workspace.getInstructionsAsync({ requestContext })
        : this._workspace.getInstructions({ requestContext });

    // Identify the workspace on the span, and record whether instructions were
    // actually produced. An empty result means the model was told nothing about
    // its filesystem or sandbox — usually a resolver returning no providers.
    tracingContext?.currentSpan?.update({
      attributes: {
        workspaceId: this._workspace.id,
        workspaceName: this._workspace.name,
        success: Boolean(instructions),
      },
    });

    if (instructions) {
      messageList.addSystem({ role: 'system', content: instructions });
    }
    return { messageList };
  }
}
