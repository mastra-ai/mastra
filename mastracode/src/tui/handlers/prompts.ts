/**
 * Event handlers for interactive prompt events:
 * ask_question, sandbox_access_request, plan_approval_required.
 */
import { savePlanToDisk } from '../../utils/plans.js';
import { AskQuestionDialogComponent } from '../components/ask-question-dialog.js';
import { AskQuestionInlineComponent } from '../components/ask-question-inline.js';
import { PlanApprovalInlineComponent } from '../components/plan-approval-inline.js';
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
  questionId: string,
  question: string,
  options?: Array<{ label: string; description?: string }>,
): Promise<void> {
  const { state } = ctx;
  return new Promise(resolve => {
    if (state.options.inlineQuestions) {
      // Capture the current ask_user component reference now, before it can be
      // overwritten by a subsequent parallel tool call.
      const askUserComponent = state.lastAskUserComponent;

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
              multiline: true,
              tui: state.ui,
              onSubmit: answer => {
                state.activeInlineQuestion = undefined;
                state.harness.respondToQuestion({ questionId, answer });
                resolve();
                processNextInlineQuestion(state);
              },
              onCancel: () => {
                state.activeInlineQuestion = undefined;
                state.harness.respondToQuestion({ questionId, answer: '(skipped)' });
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
                multiline: true,
                onSubmit: answer => {
                  state.activeInlineQuestion = undefined;
                  state.harness.respondToQuestion({ questionId, answer });
                  resolve();
                  processNextInlineQuestion(state);
                },
                onCancel: () => {
                  state.activeInlineQuestion = undefined;
                  state.harness.respondToQuestion({ questionId, answer: '(skipped)' });
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
          state.harness.respondToQuestion({ questionId, answer: '(skipped)' });
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
        multiline: true,
        tui: state.ui,
        onSubmit: answer => {
          state.ui.hideOverlay();
          state.harness.respondToQuestion({ questionId, answer });
          resolve();
        },
        onCancel: () => {
          state.ui.hideOverlay();
          state.harness.respondToQuestion({ questionId, answer: '(skipped)' });
          resolve();
        },
      });
      state.ui.showOverlay(dialog, { width: '70%', anchor: 'center' });
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
  questionId: string,
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
            state.harness.respondToQuestion({ questionId, answer });
            resolve();
            processNextInlineQuestion(state);
          },
          onCancel: () => {
            state.activeInlineQuestion = undefined;
            state.harness.respondToQuestion({ questionId, answer: 'No' });
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
 * Handle a plan_approval_required event from the submit_plan tool.
 * Shows the plan inline with Approve/Reject/Request Changes options.
 */
export async function handlePlanApproval(
  ctx: EventHandlerContext,
  planId: string,
  title: string,
  plan: string,
): Promise<void> {
  const { state } = ctx;
  return new Promise(resolve => {
    const approvalComponent = new PlanApprovalInlineComponent(
      {
        planId,
        title,
        plan,
        onApprove: async () => {
          state.activeInlinePlanApproval = undefined;
          // Store the approved plan in harness state
          await state.harness.setState({
            activePlan: {
              title,
              plan,
              approvedAt: new Date().toISOString(),
            },
          });
          // Persist plan to disk (fire-and-forget, best-effort)
          savePlanToDisk({
            title,
            plan,
            resourceId: state.harness.getResourceId(),
          }).catch(() => {});
          // Wait for plan approval to complete (switches mode, aborts stream)
          await state.harness.respondToPlanApproval({
            planId,
            response: { action: 'approved' },
          });

          // Now that mode switch is complete, add system reminder and trigger build agent
          // Use setTimeout to ensure the plan approval component has fully rendered
          setTimeout(() => {
            const reminderText = '<system-reminder>The user has approved the plan, begin executing.</system-reminder>';
            ctx.addUserMessage({
              id: `system-${Date.now()}`,
              role: 'user',
              content: [{ type: 'text', text: reminderText }],
              createdAt: new Date(),
            });
            ctx.fireMessage(reminderText);
          }, 50);

          resolve();
        },
        onReject: async (feedback?: string) => {
          state.activeInlinePlanApproval = undefined;
          await state.harness.respondToPlanApproval({
            planId,
            response: { action: 'rejected', feedback },
          });
          resolve();
        },
      },
      state.ui,
    );

    // Store as active plan approval
    state.activeInlinePlanApproval = approvalComponent;

    // Insert after the submit_plan tool component (same pattern as ask_user)
    if (state.lastSubmitPlanComponent) {
      const children = [...state.chatContainer.children];
      const submitPlanIndex = children.indexOf(state.lastSubmitPlanComponent as any);
      if (submitPlanIndex >= 0) {
        state.chatContainer.clear();
        for (let i = 0; i <= submitPlanIndex; i++) {
          state.chatContainer.addChild(children[i]!);
        }
        state.chatContainer.addChild(approvalComponent);
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
    approvalComponent.focused = true;

    ctx.notify('plan_approval', `Plan "${title}" requires approval`);
  });
}
