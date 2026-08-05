/**
 * Event handlers for interactive prompt events:
 * tool_suspended (ask_user / request_access / submit_plan).
 */
import { shouldShowDiff } from '@mastra/code-sdk/utils/plan-diff';
import { approvePlanFile, readPlanFile, resolvePlanPath } from '@mastra/code-sdk/utils/plans';
import type { AskUserSelectionMode } from '@mastra/core/tools';
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
    // The suspended run can die after the question is rendered (e.g. persisting
    // the suspended snapshot failed), in which case the session cancels the
    // suspension because the answer could never be resumed. That cancellation
    // must bypass the TUI's serialized event queue — the queue is parked on
    // this very promise — so listen on the session directly and retract the
    // prompt out-of-band.
    let cancelled = false;
    let retract: () => void = () => {};
    const unsubscribeCancel =
      state.session.subscribe?.(event => {
        if (event.type !== 'tool_suspension_cancelled' || event.toolCallId !== toolCallId) return;
        if (cancelled) return;
        cancelled = true;
        unsubscribeCancel();
        retract();
        resolve();
      }) ?? (() => {});
    const finish = () => {
      unsubscribeCancel();
      resolve();
    };

    if (state.options.inlineQuestions) {
      // Look up the streaming component created for THIS tool call. Using the
      // per-toolCallId map (instead of the single lastAskUserComponent field)
      // keeps parallel ask_user suspensions bound to their own components so
      // each question renders distinctly (#13642).
      const askUserComponent = state.pendingAskUserComponents?.get(toolCallId) ?? state.lastAskUserComponent;
      state.pendingAskUserComponents?.delete(toolCallId);

      let shownComponent: AskQuestionInlineComponent | undefined = askUserComponent;
      retract = () => {
        shownComponent?.dismiss();
        if (state.activeInlineQuestion === shownComponent) {
          state.activeInlineQuestion = undefined;
          processNextInlineQuestion(state);
        }
        state.ui.requestRender();
      };

      const activate = () => {
        // Retracted while waiting in the queue — skip activation and let the
        // next queued question take the slot.
        if (cancelled) {
          processNextInlineQuestion(state);
          return;
        }
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
                finish();
                processNextInlineQuestion(state);
              },
              onSubmitMulti: answers => {
                state.activeInlineQuestion = undefined;
                state.session.respondToToolSuspension({ toolCallId, resumeData: answers });
                finish();
                processNextInlineQuestion(state);
              },
              onCancel: () => {
                state.activeInlineQuestion = undefined;
                state.session.respondToToolSuspension({ toolCallId, resumeData: '(skipped)' });
                finish();
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
                  finish();
                  processNextInlineQuestion(state);
                },
                onSubmitMulti: answers => {
                  state.activeInlineQuestion = undefined;
                  state.session.respondToToolSuspension({ toolCallId, resumeData: answers });
                  finish();
                  processNextInlineQuestion(state);
                },
                onCancel: () => {
                  state.activeInlineQuestion = undefined;
                  state.session.respondToToolSuspension({ toolCallId, resumeData: '(skipped)' });
                  finish();
                  processNextInlineQuestion(state);
                },
              },
              state.ui,
            );
            state.chatContainer.addChild(questionComponent);
          }

          // Store as active question
          shownComponent = questionComponent;
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
          finish();
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
      retract = () => {
        state.ui.hideOverlay();
        state.ui.requestRender();
      };
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
          finish();
        },
        onSubmitMulti: answers => {
          state.ui.hideOverlay();
          state.session.respondToToolSuspension({ toolCallId, resumeData: answers });
          finish();
        },
        onCancel: () => {
          state.ui.hideOverlay();
          state.session.respondToToolSuspension({ toolCallId, resumeData: '(skipped)' });
          finish();
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
    const firePermissionResult = (decision: 'approved' | 'declined' | 'dismissed') => {
      state.hookManager
        ?.runPermissionResult('sandbox_access', toolCallId, 'request_access', decision, { path: requestedPath, reason })
        .catch(() => {});
    };
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
            firePermissionResult(answer.toLowerCase().startsWith('y') ? 'approved' : 'declined');
            state.session.respondToToolSuspension({ toolCallId, resumeData: answer });
            resolve();
            processNextInlineQuestion(state);
          },
          onCancel: () => {
            state.activeInlineQuestion = undefined;
            firePermissionResult('dismissed');
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
async function approvePlan(
  ctx: EventHandlerContext,
  toolCallId: string,
  title: string,
  plan: string,
  planPath: string | undefined,
  submittedPath: string,
): Promise<void> {
  const { state } = ctx;
  await state.session.state.set({
    activePlan: {
      title,
      plan,
      approvedAt: new Date().toISOString(),
    },
  });

  // Archive the approved plan to the global plans dir so it's findable later. The
  // local plan file is left in place so the user can review every plan made.
  if (planPath) {
    await approvePlanFile({
      planPath,
      title,
      resourceId: state.session.identity.getResourceId(),
    }).catch(() => {});
  }

  // Reset in-memory diff state so the next plan doesn't diff against this one.
  state.previousPlanSnapshot = undefined;
  state.lastSubmitPlanComponent = undefined;

  await state.session.respondToToolSuspension({
    toolCallId,
    resumeData: { action: 'approved', path: submittedPath, title, plan },
  });
}

function formatPlanGoalObjective(title: string, plan: string): string {
  return `# ${title}\n\n${plan}`;
}

export async function handlePlanApproval(
  ctx: EventHandlerContext,
  toolCallId: string,
  submittedPath: string,
): Promise<void> {
  const { state } = ctx;

  // submit_plan carries the plan file path. The agent can write the plan anywhere it
  // has access, so read whatever path it submitted (resolved relative to the project)
  // and parse the `# heading` as the title.
  const projectPath = (state.session.state.get() as any)?.projectPath as string | undefined;
  const planPath = submittedPath ? resolvePlanPath(projectPath ?? process.cwd(), submittedPath) : undefined;
  const current = planPath ? await readPlanFile(planPath) : undefined;
  if (!current) {
    state.previousPlanSnapshot = undefined;
  }

  // Surface a clear error in the approval card when the plan file can't be read,
  // instead of rendering an empty plan.
  const plan =
    current?.plan ??
    `⚠️ Could not read the plan file at \`${submittedPath}\`. Make sure it exists before submitting it.`;
  const resolvedTitle = current?.title || 'Implementation Plan';
  // Snapshot history is keyed by the submitted path so a revision of the same file
  // diffs against the prior submission, but a brand-new file renders in full.
  const snapshotKey = submittedPath;

  // A previous snapshot is only a valid diff base for a revision of the SAME
  // plan file. A different path means a brand-new plan, so render it in full
  // rather than diffing against an unrelated plan.
  const snapshot = state.previousPlanSnapshot;
  const snapshotPlan = snapshot && snapshot.path === snapshotKey ? snapshot.plan : undefined;
  const previousPlan = snapshotPlan && shouldShowDiff(snapshotPlan, plan) ? snapshotPlan : undefined;

  // Snapshot this submission (keyed by submitted path) so the next resubmission of
  // the same file can diff against it. Skip seeding history when the file
  // couldn't be read.
  if (current) {
    state.previousPlanSnapshot = { path: snapshotKey, plan };
  }

  return new Promise(resolve => {
    const planFilename = snapshotKey;
    const firePermissionResult = (decision: 'approved' | 'declined') => {
      state.hookManager
        ?.runPermissionResult('plan_approval', toolCallId, 'submit_plan', decision, { path: snapshotKey })
        .catch(() => {});
    };
    const approvalOptions = {
      toolCallId,
      title: resolvedTitle,
      plan,
      planFilename,
      previousPlan,
      onApprove: async () => {
        state.activeInlinePlanApproval = undefined;
        state.ui.setFocus(state.editor);
        firePermissionResult('approved');
        await approvePlan(ctx, toolCallId, resolvedTitle, plan, planPath, snapshotKey);
        resolve();
      },
      onGoal: async () => {
        state.activeInlinePlanApproval = undefined;
        state.ui.setFocus(state.editor);
        firePermissionResult('approved');
        await approvePlan(ctx, toolCallId, resolvedTitle, plan, planPath, snapshotKey);

        // `approvePlan` waits for plan mode to idle before `startGoal` sends
        // the canonical goal reminder, so this starts a fresh build-mode run.
        const objective = formatPlanGoalObjective(resolvedTitle, plan);
        await ctx.startGoal(objective, 'Goal cancelled.');

        const goal = state.goalManager.getGoal();
        if (goal?.id) {
          state.planStartedGoalId = goal.id;
        }

        resolve();
      },
      onReject: () => {
        state.activeInlinePlanApproval = undefined;
        state.ui.setFocus(state.editor);
        firePermissionResult('declined');
        // Resume the tool with a rejection so the rejection result is persisted
        // in thread history (the next run sees it for context). For submit_plan,
        // respondToToolSuspension resolves at the resumed tool's `tool_end`
        // boundary — i.e. once the rejection result has been emitted and the
        // suspension dropped — but BEFORE the follow-up LLM step runs. We await
        // that boundary, then abort the run host-side so the model never gets to
        // generate trailing text. This is deterministic and does not race the
        // in-loop PlanRejectionAbortProcessor (which remains as a backstop). The
        // planRejectionAbort flag suppresses the "Interrupted" abort UI so the
        // transcript stays clean for the user's revision feedback.
        void (async () => {
          try {
            await state.session.respondToToolSuspension({
              toolCallId,
              resumeData: { action: 'rejected', path: snapshotKey, title: resolvedTitle, plan },
            });
          } finally {
            state.planRejectionAbort = true;
            state.session.abort();
          }
        })();
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

    ctx.notify('plan_approval', `Plan "${resolvedTitle}" requires approval`);
  });
}
