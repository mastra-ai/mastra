/**
 * Event handlers for interactive prompt events:
 * ask_question, sandbox_access_request, plan_approval_required.
 */
import { Spacer } from '@mariozechner/pi-tui';

import { AskQuestionDialogComponent } from '../components/ask-question-dialog.js';
import { AskQuestionInlineComponent } from '../components/ask-question-inline.js';
import { PlanApprovalInlineComponent } from '../components/plan-approval-inline.js';
import { fg } from '../theme.js';

import type { EventHandlerContext } from './types.js';

/**
 * Handle an ask_question event from the ask_user tool.
 * Shows a dialog overlay and resolves the tool's pending promise.
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
      // Inline mode: Add question component to chat
      const questionComponent = new AskQuestionInlineComponent(
        {
          question,
          options,
          onSubmit: answer => {
            state.activeInlineQuestion = undefined;
            state.harness.respondToQuestion({ questionId, answer });
            resolve();
          },
          onCancel: () => {
            state.activeInlineQuestion = undefined;
            state.harness.respondToQuestion({ questionId, answer: '(skipped)' });
            resolve();
          },
        },
        state.ui,
      );

      // Store as active question
      state.activeInlineQuestion = questionComponent;

      // Insert the question right after the ask_user tool component
      if (state.lastAskUserComponent) {
        // Find the position of the ask_user component
        const children = [...state.chatContainer.children];
        const askUserIndex = children.indexOf(state.lastAskUserComponent as any);

        if (askUserIndex >= 0) {
          // Clear and rebuild with question in the right place
          state.chatContainer.clear();
          // Add all children up to and including the ask_user tool
          for (let i = 0; i <= askUserIndex; i++) {
            state.chatContainer.addChild(children[i]!);
          }

          // Add the question component with spacing
          state.chatContainer.addChild(new Spacer(1));
          state.chatContainer.addChild(questionComponent);
          state.chatContainer.addChild(new Spacer(1));

          // Add remaining children
          for (let i = askUserIndex + 1; i < children.length; i++) {
            state.chatContainer.addChild(children[i]!);
          }
        } else {
          // Fallback: add at the end
          state.chatContainer.addChild(new Spacer(1));
          state.chatContainer.addChild(questionComponent);
          state.chatContainer.addChild(new Spacer(1));
        }
      } else {
        // Fallback: add at the end if no ask_user component tracked
        state.chatContainer.addChild(new Spacer(1));
        state.chatContainer.addChild(questionComponent);
        state.chatContainer.addChild(new Spacer(1));
      }

      state.ui.requestRender();

      // Ensure the chat scrolls to show the question
      state.chatContainer.invalidate();

      // Focus the question component
      questionComponent.focused = true;
    } else {
      // Dialog mode: Show overlay
      const dialog = new AskQuestionDialogComponent({
        question,
        options,
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
 * Handle a sandbox_access_request event from the request_sandbox_access tool.
 * Shows an inline prompt for the user to approve or deny directory access.
 */
export async function handleSandboxAccessRequest(
  ctx: EventHandlerContext,
  questionId: string,
  requestedPath: string,
  reason: string,
): Promise<void> {
  const { state } = ctx;
  return new Promise(resolve => {
    const questionComponent = new AskQuestionInlineComponent(
      {
        question: `Grant sandbox access to "${requestedPath}"?\n${fg('dim', `Reason: ${reason}`)}`,
        options: [
          { label: 'Yes', description: 'Allow access to this directory' },
          { label: 'No', description: 'Deny access' },
        ],
        onSubmit: answer => {
          state.activeInlineQuestion = undefined;
          state.harness.respondToQuestion({ questionId, answer });
          resolve();
        },
        onCancel: () => {
          state.activeInlineQuestion = undefined;
          state.harness.respondToQuestion({ questionId, answer: 'No' });
          resolve();
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
    state.chatContainer.addChild(new Spacer(1));
    state.chatContainer.addChild(questionComponent);
    state.chatContainer.addChild(new Spacer(1));
    questionComponent.focused = true;
    state.ui.requestRender();
    state.chatContainer.invalidate();

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
          // Wait for plan approval to complete (switches mode, aborts stream)
          await state.harness.respondToPlanApproval({
            planId,
            response: { action: 'approved' },
          });
          ctx.updateStatusLine();

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
        state.chatContainer.addChild(new Spacer(1));
        state.chatContainer.addChild(approvalComponent);
        state.chatContainer.addChild(new Spacer(1));
        for (let i = submitPlanIndex + 1; i < children.length; i++) {
          state.chatContainer.addChild(children[i]!);
        }
      } else {
        state.chatContainer.addChild(new Spacer(1));
        state.chatContainer.addChild(approvalComponent);
        state.chatContainer.addChild(new Spacer(1));
      }
    } else {
      state.chatContainer.addChild(new Spacer(1));
      state.chatContainer.addChild(approvalComponent);
      state.chatContainer.addChild(new Spacer(1));
    }
    state.ui.requestRender();
    state.chatContainer.invalidate();
    approvalComponent.focused = true;

    ctx.notify('plan_approval', `Plan "${title}" requires approval`);
  });
}
