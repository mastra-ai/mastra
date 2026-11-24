import assert from 'node:assert/strict';
import { SessionStartupCancelledError } from '@mastra/core/agent-controller';
import type { TUIState } from '../../src/tui/state.js';
import type { McE2eScenario } from './types.js';

const CANCELLED_PROMPT = 'Interrupt this prompt before startup.';
const FAILED_PROMPT = 'Fail this prompt with a transport abort.';

export const startupInterruptedScenario: McE2eScenario = {
  name: 'startup-interrupted',
  description: 'Show interrupted startup without hiding transport failures or preventing the next prompt.',
  testName: 'handles startup cancellation and transport failure separately in the real TUI',
  useOpenAIModel: true,
  aimockFixture: 'initial-prompt.json',
  async inProcessApp({ startMastraCodeApp }) {
    return startMastraCodeApp({
      config: { disableHooks: true, disableMcp: true, unixSocketPubSub: false },
      onCreated({ session }) {
        const sendSignal = session.sendSignal.bind(session);
        // Inject failures at the Session boundary. Core tests exercise the actual
        // abort/thread-switch race; this scenario checks how the TUI presents it.
        session.sendSignal = ((...args: Parameters<typeof session.sendSignal>) => {
          const [input] = args;
          if ('content' in input && (input.content === CANCELLED_PROMPT || input.content === FAILED_PROMPT)) {
            const error =
              input.content === CANCELLED_PROMPT
                ? new SessionStartupCancelledError()
                : new DOMException('Transport failed during startup', 'AbortError');
            return { id: 'startup-failure', type: 'user', accepted: Promise.reject(error) };
          }
          return sendSignal(...args);
        }) as typeof session.sendSignal;
      },
      onTuiCreated(tui) {
        scenarioState = Reflect.get(tui as object, 'state') as TUIState;
      },
    });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Resource ID:/i, terminal);
    terminal.submit(CANCELLED_PROMPT);
    await runtime.waitForScreenText(/Interrupted/, terminal);
    assert.equal(scenarioState?.pendingSignalMessageComponentsById.size, 0);
    assert.equal(scenarioState?.messageComponentsById.has('startup-failure'), false);
    assert.ok(!scenarioState?.userInitiatedAbort, 'startup rejection must not leave a stale abort flag');

    terminal.submit(FAILED_PROMPT);
    await runtime.waitForScreenText(/Error: Transport failed during startup/, terminal);
    assert.ok(terminal.serializeHistory, 'requires terminal scrollback');
    assert.doesNotMatch(terminal.serializeHistory().output, /Error: Session startup cancelled/);

    terminal.submit('Return the Mastra Code initial prompt phrase.');
    await runtime.waitForScreenText(/MC initial prompt response/, terminal);
    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const chat = requests.filter(request => !JSON.stringify(request).includes('generate a short title'));
    assert.equal(chat.length, 1, 'only the successful follow-up should reach the provider');
  },
};

let scenarioState: TUIState | undefined;
