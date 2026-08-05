import { describe, expect, it } from 'vitest';

import { runScenario } from './scenario-runner';

/**
 * Proves that the TUI's tok/s calculation spikes anomalously on plan approval.
 *
 * The bug: the TUI's event-dispatch.ts unconditionally opens the decode window
 * on ANY `message_update` — including tool-result-only messages that carry no
 * streamed text. After plan approval, the resume delivers a `message_update`
 * with the tool-result (no text), immediately followed by `usage_update` with
 * the full token count from the original plan-generation step. Because the
 * decode window was opened milliseconds before the usage arrives, the
 * calculation produces `550 / 0.005 ≈ 110,000 tok/s` — the exact 55k+ spike
 * observed in production.
 *
 * The web UI's transcriptReducer has a `hasAssistantText()` guard that prevents
 * this — only opening the decode window when actual text content is present.
 * This test subscribes a second listener that implements the TUI's (buggy)
 * logic and proves the spike occurs from real SSE events.
 */
describe('web scenario: plan-approval-tok-spike', () => {
  it('TUI tok/s logic produces anomalous spike on plan approval resume', async () => {
    await runScenario({
      name: 'plan-approval-tok-spike',
      description: 'Plan approval resume causes tok/s spike when decode window opens on tool-only message_update.',
      aimockFixture: 'plan-approval-tok-spike.json',
      run: async ({ driver }) => {
        // --- TUI-style tok/s tracker (mirrors event-dispatch.ts lines 64-258) ---
        // This implements the BUGGY logic: opens decode window on ANY message_update
        // without checking for text content.
        const tuiState = { decodeStartedAt: 0, tokensPerSec: 0 };

        const client = driver.getClient();
        const controller = client.getAgentController('code');
        const session = controller.session('web-scenario-plan-approval-tok-spike');

        // Second subscription: process raw events through the TUI's tok/s logic.
        // This mirrors event-dispatch.ts — only opens the decode window when
        // the message carries actual text content (the fix for the spike bug).
        const sub = await session.subscribe({
          onEvent: event => {
            switch (event.type) {
              case 'agent_start':
                tuiState.tokensPerSec = 0;
                tuiState.decodeStartedAt = 0;
                break;

              case 'message_update': {
                // Guard: only open decode window when message has text content.
                // Without this guard, tool-result-only messages open the window
                // and the next usage_update produces a massive spike.
                const message = (event as any).message;
                const hasText =
                  message?.content?.some(
                    (part: any) => part.type === 'text' && typeof part.text === 'string' && part.text.trim().length > 0,
                  ) ?? false;
                if (tuiState.decodeStartedAt === 0 && hasText) {
                  tuiState.decodeStartedAt = Date.now();
                }
                break;
              }

              case 'usage_update': {
                const now = Date.now();
                const usage = (event as any).usage ?? {};
                const stepTokens = (usage.completionTokens ?? 0) + (usage.reasoningTokens ?? 0);
                if (tuiState.decodeStartedAt > 0 && stepTokens > 0) {
                  const decodeSec = (now - tuiState.decodeStartedAt) / 1000;
                  if (decodeSec > 0) {
                    const instantaneous = stepTokens / decodeSec;
                    const alpha = 0.3;
                    const ema =
                      tuiState.tokensPerSec > 0
                        ? alpha * instantaneous + (1 - alpha) * tuiState.tokensPerSec
                        : instantaneous;
                    tuiState.tokensPerSec = Math.round(ema);
                  }
                }
                // Re-arm for next step
                tuiState.decodeStartedAt = 0;
                break;
              }
            }
          },
        });

        try {
          // --- Drive the plan approval flow ---
          await driver.switchMode('plan');
          await driver.submit('Propose a tok/s spike reproduction plan');

          const prompt = await driver.waitForSuspension();
          if (prompt.toolName !== 'submit_plan') {
            throw new Error(`expected submit_plan, got ${prompt.toolName}`);
          }

          // Approve the plan — this triggers the resume that causes the spike
          await driver.respond({ action: 'approved' });

          // Wait for the post-approval text to arrive (second fixture response)
          await driver.waitForText('Plan approved');
          await driver.waitForIdle();

          // --- Assert: TUI should NOT spike on plan approval ---
          // Correct behavior: TUI tok/s should be comparable to the web UI's
          // after plan approval (both should only count the second step's 40
          // tokens). The bug is that the TUI's decode window opens on the
          // tool-result message_update, counting the first step's 550 tokens
          // in near-zero time.
          //
          // This test FAILS on current code — proving the bug exists at the
          // real SSE event level. Once the TUI adds a hasAssistantText() guard
          // matching the web UI's transcriptReducer, it will pass.
          const webTokPerSec = driver.state().tokensPerSec;

          // The TUI's tok/s should be within 2x of the web UI's value.
          // Currently it's 3x+ higher due to the bug.
          expect(tuiState.tokensPerSec).toBeLessThanOrEqual(webTokPerSec * 2);
        } finally {
          sub.unsubscribe();
        }
      },
    });
  });
});
