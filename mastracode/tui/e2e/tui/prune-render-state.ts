import type { Component } from '@earendil-works/pi-tui';

import type { AssistantRenderRecord } from '../../src/tui/assistant-render-registry.js';
import type { TUIState } from '../../src/tui/state.js';
import type { McE2eScenario } from './types.js';

let tuiState: TUIState | undefined;

const DIRECT_COMPONENT_OWNERS = [
  'streamingComponent',
  'lastAskUserComponent',
  'activeInlineQuestion',
  'activeInlinePlanApproval',
  'pendingFocus',
  'activeOnboarding',
  'lastSubmitPlanComponent',
  'omProgressComponent',
  'activeOMMarker',
  'activeBufferingMarker',
  'activeActivationMarker',
  'activeActivationProviderChangeMarker',
  'taskProgress',
] as const satisfies ReadonlyArray<keyof TUIState>;

function countTrackedReferences(state: TUIState, component: Component): number {
  let references = state.chatContainer.children.filter(child => child === component).length;

  for (const map of [
    state.messageComponentsById,
    state.pendingTools,
    state.pendingSubagents,
    state.pendingAskUserComponents,
    state.pendingSubmitPlanComponents,
  ] as ReadonlyArray<Map<string, unknown>>) {
    for (const value of map.values()) if (value === component) references++;
  }
  for (const pending of state.pendingSignalMessageComponentsById.values()) {
    if (pending.component === component) references++;
  }
  for (const collection of [
    state.allToolComponents,
    state.allSlashCommandComponents,
    state.allSystemReminderComponents,
    state.allShellComponents,
    state.followUpComponents,
  ] as ReadonlyArray<unknown[]>) {
    references += collection.filter(value => value === component).length;
  }
  for (const key of DIRECT_COMPONENT_OWNERS) if (state[key] === component) references++;
  if (state.activeGoalJudge?.component === component) references++;

  const records = Reflect.get(state.assistantRenderRegistry, 'records') as Map<string, AssistantRenderRecord>;
  for (const record of records.values()) {
    for (const segment of record.segments.values()) if (segment.component === component) references++;
  }

  return references;
}

export const pruneRenderStateScenario: McE2eScenario = {
  name: 'prune-render-state',
  description: 'Prune complete chat entries and release their tracked render references after a large real agent turn.',
  testName: 'retains newest output and removes all tracked identities for pruned entries',
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'prune-render-state.json',
  async inProcessApp({ startMastraCodeApp }) {
    return startMastraCodeApp({
      onTuiCreated(tui) {
        if ((typeof tui !== 'object' && typeof tui !== 'function') || tui === null) {
          throw new Error('Expected a TUI instance');
        }
        tuiState = Reflect.get(tui, 'state') as TUIState;
      },
    });
  },
  async run({ terminal, runtime }) {
    terminal.resize(300, 20);
    await runtime.waitForScreenText(/Project:/i, terminal);
    if (!tuiState) throw new Error('Expected prune scenario to capture TUI state');

    terminal.submit('Exercise prune render state.');

    let prunedTool: Component | undefined;
    let retainedTool: Component | undefined;
    const thresholdDeadline = Date.now() + 30_000;
    while ((!prunedTool || !retainedTool) && Date.now() < thresholdDeadline) {
      prunedTool ??= tuiState.pendingAskUserComponents.get('call_prune_0100');
      retainedTool ??= tuiState.pendingTools.get('call_prune_0599') as Component | undefined;
      await runtime.sleep(10);
    }
    if (!prunedTool || !retainedTool) {
      throw new Error(
        `Expected oldest and newest streamed tools during active pruning; children=${tuiState.chatContainer.children.length}`,
      );
    }

    await runtime.waitForScreenText(/search_content/, terminal, 15_000);
    terminal.keyCtrlC();

    const pruneDeadline = Date.now() + 15_000;
    while (tuiState.chatContainer.children.length > 500 && Date.now() < pruneDeadline) {
      await runtime.sleep(20);
    }

    const childCount = tuiState.chatContainer.children.length;
    if (childCount > 500) throw new Error(`Expected pruning to stay within 500 children, received ${childCount}`);
    if (childCount < 250) throw new Error(`Expected pruning to retain at least 250 children, received ${childCount}`);

    const prunedReferences = countTrackedReferences(tuiState, prunedTool);
    if (prunedReferences !== 0) {
      throw new Error(`Expected zero tracked references to pruned tool, received ${prunedReferences}`);
    }
    const retainedReferences = countTrackedReferences(tuiState, retainedTool);
    if (retainedReferences === 0) throw new Error('Expected newest tool identity to remain tracked after pruning');

    if (!terminal.serialize().view.includes('search_content')) {
      throw new Error('Expected newest tool output to remain rendered after pruning');
    }

    runtime.printScreen(`prune render state (${childCount} children, zero stale references)`, terminal);
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 1) {
      throw new Error(`Expected prune render state scenario to make 1 AIMock request, received ${requests.length}`);
    }
    const request = JSON.stringify(requests[0]);
    if (!request.includes('Exercise prune render state.')) {
      throw new Error('Expected AIMock request to include the pruning workload prompt');
    }
  },
};
