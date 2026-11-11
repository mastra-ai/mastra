import path from 'node:path';
import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import { AgentsMDInjector } from '@mastra/core/processors';
import type { ProcessInputStepArgs } from '@mastra/core/processors';
import {
  createGitRefReminderReader,
  instructionSourcePaths,
  loadSessionBaseRefInstructions,
  loadSessionInstructions,
  sessionInstructionRoots,
} from './agent-instructions.js';
import type { GitRefInstructions, GitRefInstructionsCache } from './git-ref-instructions.js';

interface SessionInstructionState {
  untrustedCheckout?: boolean;
  baseRef?: string;
  projectPath?: string;
  instructionRoots?: string[];
}

/** What one model step's reminders are decided from, read once before the step. */
interface Step {
  state: SessionInstructionState | undefined;
  projectPath: string;
  baseRefInstructions: GitRefInstructions | undefined;
  ignoredPaths?: string[];
}

/**
 * The reminder channel for instruction files (AGENTS.md and friends) next to
 * the paths a session's tools touch.
 *
 * Untrusted checkouts (review sessions on PR branches) must not have the
 * working tree's instruction files injected as system reminders: those files
 * are attacker-writable content, not configuration. When the session carries a
 * trusted base ref, reminders are served from that ref instead; without one
 * they are disabled.
 */
export function createInstructionReminders({
  rootPath,
  gitRefInstructionsCache,
}: {
  /** Checkout of sessions that carry no project path of their own. */
  rootPath: string;
  /** A live session's base-ref instructions; without it the base ref is read from git on every step. */
  gitRefInstructionsCache: (sessionId: string) => GitRefInstructionsCache | undefined;
}): AgentsMDInjector {
  // The injector's hooks are synchronous, so everything a step needs from git
  // is loaded before the step runs and looked up here by the step's arguments.
  const steps = new WeakMap<ProcessInputStepArgs, Step>();

  const prepare = async ({ requestContext }: ProcessInputStepArgs): Promise<Step> => {
    const controller = requestContext?.get('controller') as
      | AgentControllerRequestContext<SessionInstructionState>
      | undefined;
    const state = controller?.getState();
    const projectPath = state?.projectPath ?? rootPath;
    const baseRefInstructions = await loadSessionBaseRefInstructions(
      {
        workingDir: projectPath,
        instructionRoots: state?.instructionRoots,
        untrustedCheckout: state?.untrustedCheckout,
        baseRef: state?.baseRef,
      },
      controller?.sessionId ? gitRefInstructionsCache(controller.sessionId) : undefined,
    );
    return { state, projectPath, baseRefInstructions };
  };

  class InstructionReminders extends AgentsMDInjector {
    override async processInputStep(args: ProcessInputStepArgs) {
      steps.set(args, await prepare(args));
      return super.processInputStep(args);
    }
  }

  return new InstructionReminders({
    isEnabled: args => {
      const step = steps.get(args);
      return step?.state?.untrustedCheckout !== true || step.baseRefInstructions !== undefined;
    },
    // Resolve relative tool paths against the session checkout (not the host
    // process cwd) and never surface instruction files from outside it.
    getBasePath: args => steps.get(args)?.projectPath ?? rootPath,
    getReader: args => {
      const step = steps.get(args);
      if (!step?.baseRefInstructions) return undefined;
      const { projectPath } = step;
      const [primary] = sessionInstructionRoots(projectPath, step.state?.instructionRoots);
      const reader = createGitRefReminderReader(primary!, step.baseRefInstructions);
      if (primary === projectPath) return reader;
      // The base ref covers the session's own checkout only; the other
      // checkouts under the working directory are never read off disk.
      const outsidePrimary = (filePath: string) => {
        const inProject = path.relative(projectPath, filePath);
        const inPrimary = path.relative(primary!, filePath);
        const under = (rel: string) => rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
        return under(inProject) && !under(inPrimary);
      };
      return {
        ...reader,
        pathExists: filePath => !outsidePrimary(filePath) && reader.pathExists(filePath),
        isDirectory: filePath => !outsidePrimary(filePath) && reader.isDirectory(filePath),
      };
    },
    getIgnoredInstructionPaths: args => {
      const step = steps.get(args);
      if (!step) return [];
      // Same sources, through the same readers, as the static prompt, so the
      // dedup stays consistent on untrusted checkouts and across roots.
      step.ignoredPaths ??= instructionSourcePaths(
        loadSessionInstructions({
          workingDir: step.projectPath,
          instructionRoots: step.state?.instructionRoots,
          untrustedCheckout: step.baseRefInstructions !== undefined,
          baseRefInstructions: step.baseRefInstructions,
        }),
        sessionInstructionRoots(step.projectPath, step.state?.instructionRoots),
      );
      return step.ignoredPaths;
    },
  });
}
