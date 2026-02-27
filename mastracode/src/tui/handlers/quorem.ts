/**
 * Event handlers for quorem parallel agent session events:
 * quorem_start, quorem_agent_start, quorem_agent_progress,
 * quorem_agent_end, quorem_review_start, quorem_merged, quorem_cancelled.
 */
import type { QuoremAgentConfig } from '@mastra/core/harness';

import { QuoremStatusComponent } from '../components/quorem-status.js';
import type { TUIState } from '../state.js';

import type { EventHandlerContext } from './types.js';

/**
 * Ensure the QuoremStatusComponent exists and is attached.
 * Returns the component for further updates.
 */
function ensureQuoremStatusComponent(state: TUIState): QuoremStatusComponent {
  if (!(state as any)._quoremStatusComponent) {
    (state as any)._quoremStatusComponent = new QuoremStatusComponent();
  }
  return (state as any)._quoremStatusComponent;
}

export function handleQuoremStart(
  ctx: EventHandlerContext,
  sessionId: string,
  task: string,
  agents: QuoremAgentConfig[],
): void {
  const { state } = ctx;
  const ds = state.harness.getDisplayState();

  ctx.showInfo(`Quorem session started: ${agents.length} agents working on task.`);

  // Update the persistent status component
  const comp = ensureQuoremStatusComponent(state);
  comp.updateSession(ds.activeQuoremSession ?? null);

  // Insert component into chat if not already there
  if (!state.chatContainer.children.includes(comp as any)) {
    ctx.addChildBeforeFollowUps(comp);
  }

  state.ui.requestRender();
}

export function handleQuoremAgentStart(
  ctx: EventHandlerContext,
  sessionId: string,
  agentId: string,
): void {
  const { state } = ctx;
  const ds = state.harness.getDisplayState();

  const comp = ensureQuoremStatusComponent(state);
  comp.updateSession(ds.activeQuoremSession ?? null);
  state.ui.requestRender();
}

export function handleQuoremAgentProgress(
  ctx: EventHandlerContext,
  sessionId: string,
  agentId: string,
  summary: string,
): void {
  const { state } = ctx;
  const ds = state.harness.getDisplayState();

  const comp = ensureQuoremStatusComponent(state);
  comp.updateSession(ds.activeQuoremSession ?? null);
  state.ui.requestRender();
}

export function handleQuoremAgentEnd(
  ctx: EventHandlerContext,
  sessionId: string,
  agentId: string,
  status: string,
): void {
  const { state } = ctx;
  const ds = state.harness.getDisplayState();

  const comp = ensureQuoremStatusComponent(state);
  comp.updateSession(ds.activeQuoremSession ?? null);

  // Clear the quorem agent view if the agent we're viewing just ended
  if (state.viewingQuoremAgentId === agentId) {
    // Keep viewing — the user can /quorem back when ready
  }

  state.ui.requestRender();
}

export function handleQuoremReviewStart(
  ctx: EventHandlerContext,
  sessionId: string,
): void {
  const { state } = ctx;
  const ds = state.harness.getDisplayState();

  ctx.showInfo('All quorem agents finished. Main agent is reviewing results...');

  const comp = ensureQuoremStatusComponent(state);
  comp.updateSession(ds.activeQuoremSession ?? null);
  state.ui.requestRender();
}

export function handleQuoremMerged(
  ctx: EventHandlerContext,
  sessionId: string,
  winnerId: string,
): void {
  const { state } = ctx;
  const ds = state.harness.getDisplayState();

  ctx.showInfo(`Quorem session complete. Winner: ${winnerId}. Changes merged.`);

  // Clear the viewing state
  state.viewingQuoremAgentId = undefined;

  const comp = ensureQuoremStatusComponent(state);
  comp.updateSession(ds.activeQuoremSession ?? null);
  state.ui.requestRender();
}

export function handleQuoremCancelled(
  ctx: EventHandlerContext,
  sessionId: string,
): void {
  const { state } = ctx;
  const ds = state.harness.getDisplayState();

  ctx.showInfo('Quorem session cancelled.');

  // Clear the viewing state
  state.viewingQuoremAgentId = undefined;

  const comp = ensureQuoremStatusComponent(state);
  comp.updateSession(ds.activeQuoremSession ?? null);
  state.ui.requestRender();
}
