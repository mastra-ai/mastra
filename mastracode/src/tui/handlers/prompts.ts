/**
 * Event handlers for interactive prompt events:
 * tool_suspended (ask_user / request_access / submit_plan).
 */
import type { AskUserSelectionMode } from '@mastra/core/tools';
import { savePlanToDisk, savePlanSnapshot } from '../../utils/plans.js';
import { AskQuestionDialogComponent } from '../components/ask-question-dialog.js';
import { AskQuestionInlineComponent } from '../components/ask-question-inline.js';
import { PlanApprovalInlineComponent } from '../components/plan-approval-inline.js';
import { showModalOverlay } from '../overlay.js';
import type { TUIState } from '../state.js';
import { theme } from '../theme.js';

import type { EventHandlerContext } from './types.js';

/**
 * Process the next pending inline question from the queue.
 * Called when the current active question is resolved (submitted or cancelled).
 */
function processNextInlineQuestion(state: TUIState): void {
  const next = state.pendingInlineQuestions.shift();
  if (next) {
    next();
  }
}

/**
 * Handle an ask_question event from the ask_user tool.
 * Shows a dialog overlay and resolves the tool's pending promise.
 *
 * If another inline question is already active, the new question is queued
 * and will be shown once the current one is answered.
 */
export async function handleAskQuestion(
  ctx: EventHandlerContext,
  toolCallId: string,
  question: string,
  options?: Array<{ label: string; description?: string }>,
  selectionMode?: AskUserSelectionMode,
): Promise<void> {
  const { state } = ctx;

  return new Promise(resolve => {
    if (state.options.inlineQuestions) {
      // Look up the streaming component created for THIS tool call. Using the
      // per-toolCallId map (instead of the single lastAskUserComponent field)
      // keeps parallel ask_user suspensions bound to their own components so
      // each question renders distinctly (#13642).
      const askUserComponent = state.pendingAskUserComponents?.get(toolCallId) ?? state.lastAskUserComponent;
      state.pendingAskUserComponents?.delete(toolCallId);

      const activate = () => {
        try {
          let questionComponent: AskQuestionInlineComponent;

          if (askUserComponent) {
            // Activate the existing streaming component with interactive elements.
            // ask_user is the agent's free-text channel — opt into multiline so users
            // can paste logs / write paragraph-length replies.
            askUserComponent.activate({
              question,
              options,
              selectionMode,
              multiline: true,
              tui: state.ui,
              onSubmit: answer => {
                state.activeInlineQuestion = undefined;
                state.session.respondToToolSuspension({ toolCallId, resumeData: answer });
                resolve();
                processNextInlineQuestion(state);
              },
              onSubmitMulti: answers => {
                state.activeInlineQuestion = undefined;
                state.session.respondToToolSuspension({ toolCallId, resumeData: answers });
                resolve();
                processNextInlineQuestion(state);
              },
              onCancel: () => {
                state.activeInlineQuestion = undefined;
                state.session.respondToToolSuspension({ toolCallId, resumeData: '(skipped)' });
                resolve();
                processNextInlineQuestion(state);
              },
            });
            questionComponent = askUserComponent;
          } else {
            // Fallback: create a new component if no streaming one exists.
            // Multiline opt-in matches the streaming branch above.
            questionComponent = new AskQuestionInlineComponent(
              {
                question,
                options,
                selectionMode,
                multiline: true,
                onSubmit: answer => {
                  state.activeInlineQuestion = undefined;
                  state.session.respondToToolSuspension({ toolCallId, resumeData: answer });
                  resolve();
                  processNextInlineQuestion(state);
                },
                onSubmitMulti: answers => {
                  state.activeInlineQuestion = undefined;
                  state.session.respondToToolSuspension({ toolCallId, resumeData: answers });
                  resolve();
                  processNextInlineQuestion(state);
                },
                onCancel: () => {
                  state.activeInlineQuestion = undefined;
                  state.session.respondToToolSuspension({ toolCallId, resumeData: '(skipped)' });
                  resolve();
                  processNextInlineQuestion(state);
                },
              },
              state.ui,
            );
            state.chatContainer.addChild(questionComponent);
          }

          // Store as active question
          state.activeInlineQuestion = questionComponent;

          state.ui.requestRender();

          // Ensure the chat scrolls to show the question
          state.chatContainer.invalidate();

          // Focus the question component
          questionComponent.focused = true;
        } catch {
          // Don't let ask_user errors crash the process — skip the question
          state.activeInlineQuestion = undefined;
          state.session.respondToToolSuspension({ toolCallId, resumeData: '(skipped)' });
          resolve();
          processNextInlineQuestion(state);
        }
      };

      // If another inline question is already active, queue this one
      if (state.activeInlineQuestion) {
        state.pendingInlineQuestions.push(activate);
      } else {
        activate();
      }
    } else {
      // Dialog mode: Show overlay. Multiline opt-in matches the inline branch.
      const dialog = new AskQuestionDialogComponent({
        question,
        options,
        selectionMode,
        multiline: true,
        tui: state.ui,
        onSubmit: answer => {
          state.ui.hideOverlay();
          state.session.respondToToolSuspension({ toolCallId, resumeData: answer });
          resolve();
        },
        onSubmitMulti: answers => {
          state.ui.hideOverlay();
          state.session.respondToToolSuspension({ toolCallId, resumeData: answers });
          resolve();
        },
        onCancel: () => {
          state.ui.hideOverlay();
          state.session.respondToToolSuspension({ toolCallId, resumeData: '(skipped)' });
          resolve();
        },
      });
      showModalOverlay(state.ui, dialog, { widthPercent: 0.7 });
      dialog.focused = true;
    }

    ctx.notify('ask_question', question);
  });
}

/**
 * Handle a sandbox_access_request event from the request_access tool.
 * Shows an inline prompt for the user to approve or deny directory access.
 *
 * If another inline question is already active, the new prompt is queued
 * and will be shown once the current one is answered.
 */
export async function handleSandboxAccessRequest(
  ctx: EventHandlerContext,
  toolCallId: string,
  requestedPath: string,
  reason: string,
): Promise<void> {
  const { state } = ctx;
  return new Promise(resolve => {
    const activate = () => {
      const questionComponent = new AskQuestionInlineComponent(
        {
          question: `Grant sandbox access to "${requestedPath}"?\n${theme.fg('dim', `Reason: ${reason}`)}`,
          options: [
            { label: 'Yes', description: 'Allow access to this directory' },
            { label: 'No', description: 'Deny access' },
          ],
          onSubmit: answer => {
            state.activeInlineQuestion = undefined;
            state.session.respondToToolSuspension({ toolCallId, resumeData: answer });
            resolve();
            processNextInlineQuestion(state);
          },
          onCancel: () => {
            state.activeInlineQuestion = undefined;
            state.session.respondToToolSuspension({ toolCallId, resumeData: 'No' });
            resolve();
            processNextInlineQuestion(state);
          },
          formatResult: answer => {
            const approved = answer.toLowerCase().startsWith('y');
            return approved ? `Granted access to ${requestedPath}` : `Denied access to ${requestedPath}`;
          },
          isNegativeAnswer: answer => !answer.toLowerCase().startsWith('y'),
        },
        state.ui,
      );

      // Store as active question so input routing works
      state.activeInlineQuestion = questionComponent;

      // Add to chat
      state.chatContainer.addChild(questionComponent);
      questionComponent.focused = true;
      state.ui.requestRender();
      state.chatContainer.invalidate();
    };

    // If another inline question is already active, queue this one
    if (state.activeInlineQuestion) {
      state.pendingInlineQuestions.push(activate);
    } else {
      activate();
    }

    ctx.notify('sandbox_access', `Sandbox access requested: ${requestedPath}`);
  });
}

/**
 * Handle a suspended submit_plan tool call.
 * Shows the plan inline with Approve/Use as Goal/Request Changes options.
 *
 * On each submission the plan is saved to a `.md` file and the previous plan
 * content is snapshotted so that resubmissions can show a diff.
 *
 * "Request changes" rejects the tool call and aborts the agent so the user can
 * provide revision feedback via a normal chat message.
 */
async function approvePlan(ctx: EventHandlerContext, toolCallId: string, title: string, plan: string): Promise<void> {
  const { state } = ctx;
  await state.session.state.set({
    activePlan: {
      title,
      plan,
      approvedAt: new Date().toISOString(),
    },
  });
  savePlanToDisk({
    title,
    plan,
    resourceId: state.session.identity.getResourceId(),
  }).catch(() => {});
  await state.session.respondToToolSuspension({
    toolCallId,
    resumeData: { action: 'approved' },
  });
}

function formatPlanGoalObjective(title: string, plan: string): string {
  return `# ${title}\n\n${plan}`;
}

export async function handlePlanApproval(
  ctx: EventHandlerContext,
  toolCallId: string,
  title: string,
  plan: string,
): Promise<void> {
  const { state } = ctx;

  // Snapshot current plan for diff display on resubmission
  const previousPlan = state.previousPlanSnapshot?.plan;

  // Save a snapshot of this submission and write to local plans dir
  state.previousPlanSnapshot = { title, plan };
  const projectPath = (state.session.state.get() as any)?.projectPath as string | undefined;
  if (projectPath) {
    savePlanSnapshot({
      title,
      plan,
      resourceId: state.session.identity.getResourceId(),
      projectPath,
    }).catch(() => {});
  }

  return new Promise(resolve => {
    const approvalOptions = {
      toolCallId,
      title,
      plan,
      previousPlan,
      onApprove: async () => {
        state.activeInlinePlanApproval = undefined;
        state.ui.setFocus(state.editor);
        await approvePlan(ctx, toolCallId, title, plan);
        resolve();
      },
      onGoal: async () => {
        state.activeInlinePlanApproval = undefined;
        state.ui.setFocus(state.editor);
        await approvePlan(ctx, toolCallId, title, plan);

        // `approvePlan` waits for plan mode to idle before `startGoal` sends
        // the canonical goal reminder, so this starts a fresh build-mode run.
        const objective = formatPlanGoalObjective(title, plan);
        await ctx.startGoal(objective, 'Goal cancelled.');

        const goal = state.goalManager.getGoal();
        if (goal?.id) {
          state.planStartedGoalId = goal.id;
        }

        resolve();
      },
      onReject: async () => {
        state.activeInlinePlanApproval = undefined;
        state.ui.setFocus(state.editor);
        // Resume the tool with a rejection so the result is persisted in thread
        // history. The PlanRejectionAbortProcessor detects the rejection tool
        // result and aborts from within the agentic loop — preventing any
        // additional LLM call without a timing gap.
        await state.session.respondToToolSuspension({
          toolCallId,
          resumeData: { action: 'rejected' },
        });
        resolve();
      },
    };

    const approvalComponent =
      state.lastSubmitPlanComponent instanceof PlanApprovalInlineComponent
        ? state.lastSubmitPlanComponent
        : new PlanApprovalInlineComponent(approvalOptions, state.ui);
    approvalComponent.activate(approvalOptions);

    // Store as active plan approval
    state.activeInlinePlanApproval = approvalComponent;

    // Insert after the submit_plan placeholder; if streaming already created the
    // plan box, activate that component in place instead of rendering a duplicate.
    if (state.lastSubmitPlanComponent) {
      const children = [...state.chatContainer.children];
      const submitPlanIndex = children.indexOf(state.lastSubmitPlanComponent as any);
      if (submitPlanIndex >= 0) {
        state.chatContainer.clear();
        for (let i = 0; i <= submitPlanIndex; i++) {
          state.chatContainer.addChild(children[i]!);
        }
        if (state.lastSubmitPlanComponent !== approvalComponent) {
          state.chatContainer.addChild(approvalComponent);
        }
        for (let i = submitPlanIndex + 1; i < children.length; i++) {
          state.chatContainer.addChild(children[i]!);
        }
      } else {
        state.chatContainer.addChild(approvalComponent);
      }
    } else {
      state.chatContainer.addChild(approvalComponent);
    }
    state.ui.requestRender();
    state.chatContainer.invalidate();
    state.ui.setFocus(approvalComponent);

    ctx.notify('plan_approval', `Plan "${title}" requires approval`);
  });
}
