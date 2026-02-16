/**
 * Observational Memory Fixtures
 *
 * These fixtures simulate the streaming events that occur during
 * observational memory operations (observation start, progress, end, failed).
 *
 * SCENARIO: Agent with OM enabled processes messages and triggers observations
 * EXPECTED BEHAVIOR:
 * - Progress bars update in real-time during streaming
 * - Observation markers appear in chat history
 * - Sidebar shows observation status and content
 * - Observations persist after page reload
 */

// Unique IDs for test consistency
const RECORD_ID = 'test-om-record-123';
const THREAD_ID = 'test-thread-456';
const CYCLE_ID = 'test-cycle-789';

/**
 * Fixture: Observation completes successfully
 * Tests: Progress bar updates, observation marker shows completion, sidebar updates
 */
export const omObservationSuccessFixture = [
  // Initial text response with progress updates
  [
    { type: 'stream-start', warnings: [] },
    {
      type: 'response-metadata',
      id: 'resp_om_test_001',
      timestamp: new Date().toISOString(),
      modelId: 'gpt-4o-mini',
    },
    // Status update - 50% of threshold
    {
      type: 'data-om-status',
      data: {
        windows: {
          active: {
            messages: { tokens: 5000, threshold: 10000 },
            observations: { tokens: 0, threshold: 40000 },
          },
          buffered: {
            observations: {
              chunks: 0,
              messageTokens: 0,
              observationTokens: 0,
              projectedMessageRemoval: 0,
              status: 'idle' as const,
            },
            reflection: {
              observationTokens: 0,
              inputObservationTokens: 0,
              status: 'idle' as const,
            },
          },
        },
        recordId: RECORD_ID,
        threadId: THREAD_ID,
        stepNumber: 0,
        generationCount: 0,
      },
    },
    {
      type: 'text-start',
      id: 'msg_om_test_001',
      providerMetadata: {},
    },
    { type: 'text-delta', id: 'msg_om_test_001', delta: 'I' },
    { type: 'text-delta', id: 'msg_om_test_001', delta: ' understand' },
    { type: 'text-delta', id: 'msg_om_test_001', delta: '.' },
    { type: 'text-delta', id: 'msg_om_test_001', delta: ' Let' },
    { type: 'text-delta', id: 'msg_om_test_001', delta: ' me' },
    { type: 'text-delta', id: 'msg_om_test_001', delta: ' help' },
    { type: 'text-delta', id: 'msg_om_test_001', delta: ' you' },
    { type: 'text-delta', id: 'msg_om_test_001', delta: '.' },
    // Status update - 100% of threshold, will observe
    {
      type: 'data-om-status',
      data: {
        windows: {
          active: {
            messages: { tokens: 10500, threshold: 10000 },
            observations: { tokens: 0, threshold: 40000 },
          },
          buffered: {
            observations: {
              chunks: 0,
              messageTokens: 0,
              observationTokens: 0,
              projectedMessageRemoval: 0,
              status: 'idle' as const,
            },
            reflection: {
              observationTokens: 0,
              inputObservationTokens: 0,
              status: 'idle' as const,
            },
          },
        },
        recordId: RECORD_ID,
        threadId: THREAD_ID,
        stepNumber: 1,
        generationCount: 0,
      },
    },
    // Observation starts
    {
      type: 'data-om-observation-start',
      data: {
        cycleId: CYCLE_ID,
        operationType: 'observation',
        startedAt: new Date().toISOString(),
        tokensToObserve: 10500,
        recordId: RECORD_ID,
        threadId: THREAD_ID,
        threadIds: [THREAD_ID],
        config: {
          messageTokens: 10000,
          observationTokensThreshold: 40000,
        },
      },
    },
    // Observation completes
    {
      type: 'data-om-observation-end',
      data: {
        cycleId: CYCLE_ID,
        operationType: 'observation',
        completedAt: new Date().toISOString(),
        durationMs: 2500,
        tokensObserved: 10500,
        observationTokens: 850,
        observations: `## January 27, 2026

### Thread: test-thread-456
- 🔴 User asked for help with a task
- User mentioned they need assistance`,
        currentTask: 'Help the user with their request',
        suggestedResponse: 'I can help you with that. What specifically do you need?',
        recordId: RECORD_ID,
        threadId: THREAD_ID,
      },
    },
    {
      type: 'finish',
      finishReason: 'stop',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    },
  ],
];

/**
 * Fixture: Observation fails
 * Tests: Failed observation marker shows error state, retry indication
 */
export const omObservationFailedFixture = [
  [
    { type: 'stream-start', warnings: [] },
    {
      type: 'response-metadata',
      id: 'resp_om_fail_001',
      timestamp: new Date().toISOString(),
      modelId: 'gpt-4o-mini',
    },
    {
      type: 'text-start',
      id: 'msg_om_fail_001',
      providerMetadata: {},
    },
    { type: 'text-delta', id: 'msg_om_fail_001', delta: 'Processing' },
    { type: 'text-delta', id: 'msg_om_fail_001', delta: '...' },
    // Status update
    {
      type: 'data-om-status',
      data: {
        windows: {
          active: {
            messages: { tokens: 10500, threshold: 10000 },
            observations: { tokens: 0, threshold: 40000 },
          },
          buffered: {
            observations: {
              chunks: 0,
              messageTokens: 0,
              observationTokens: 0,
              projectedMessageRemoval: 0,
              status: 'idle' as const,
            },
            reflection: {
              observationTokens: 0,
              inputObservationTokens: 0,
              status: 'idle' as const,
            },
          },
        },
        recordId: RECORD_ID,
        threadId: THREAD_ID,
        stepNumber: 1,
        generationCount: 0,
      },
    },
    // Observation starts
    {
      type: 'data-om-observation-start',
      data: {
        cycleId: 'fail-cycle-001',
        operationType: 'observation',
        startedAt: new Date().toISOString(),
        tokensToObserve: 10500,
        recordId: RECORD_ID,
        threadId: THREAD_ID,
        threadIds: [THREAD_ID],
        config: {
          messageTokens: 10000,
          observationTokensThreshold: 40000,
        },
      },
    },
    // Observation fails
    {
      type: 'data-om-observation-failed',
      data: {
        cycleId: 'fail-cycle-001',
        operationType: 'observation',
        failedAt: new Date().toISOString(),
        durationMs: 1500,
        tokensAttempted: 10500,
        error: 'Observer model rate limited',
        recordId: RECORD_ID,
        threadId: THREAD_ID,
      },
    },
    {
      type: 'finish',
      finishReason: 'stop',
      usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
    },
  ],
];

/**
 * Fixture: Reflection occurs after observation
 * Tests: Reflection marker shows in chat, sidebar shows reflection status
 */
export const omReflectionFixture = [
  [
    { type: 'stream-start', warnings: [] },
    {
      type: 'response-metadata',
      id: 'resp_om_reflect_001',
      timestamp: new Date().toISOString(),
      modelId: 'gpt-4o-mini',
    },
    {
      type: 'text-start',
      id: 'msg_om_reflect_001',
      providerMetadata: {},
    },
    { type: 'text-delta', id: 'msg_om_reflect_001', delta: 'Here' },
    { type: 'text-delta', id: 'msg_om_reflect_001', delta: ' is' },
    { type: 'text-delta', id: 'msg_om_reflect_001', delta: ' my' },
    { type: 'text-delta', id: 'msg_om_reflect_001', delta: ' response' },
    { type: 'text-delta', id: 'msg_om_reflect_001', delta: '.' },
    // Status update - observation threshold met
    {
      type: 'data-om-status',
      data: {
        windows: {
          active: {
            messages: { tokens: 10500, threshold: 10000 },
            observations: { tokens: 35000, threshold: 40000 },
          },
          buffered: {
            observations: {
              chunks: 0,
              messageTokens: 0,
              observationTokens: 0,
              projectedMessageRemoval: 0,
              status: 'idle' as const,
            },
            reflection: {
              observationTokens: 0,
              inputObservationTokens: 0,
              status: 'idle' as const,
            },
          },
        },
        recordId: RECORD_ID,
        threadId: THREAD_ID,
        stepNumber: 1,
        generationCount: 0,
      },
    },
    // Observation starts
    {
      type: 'data-om-observation-start',
      data: {
        cycleId: 'reflect-obs-cycle',
        operationType: 'observation',
        startedAt: new Date().toISOString(),
        tokensToObserve: 10500,
        recordId: RECORD_ID,
        threadId: THREAD_ID,
        threadIds: [THREAD_ID],
        config: {
          messageTokens: 10000,
          observationTokensThreshold: 40000,
        },
      },
    },
    // Observation completes - now over reflection threshold
    {
      type: 'data-om-observation-end',
      data: {
        cycleId: 'reflect-obs-cycle',
        operationType: 'observation',
        completedAt: new Date().toISOString(),
        durationMs: 2000,
        tokensObserved: 10500,
        observationTokens: 6000,
        observations: '## January 27, 2026\n\n- New observations added',
        recordId: RECORD_ID,
        threadId: THREAD_ID,
      },
    },
    // Reflection starts (observations now exceed threshold)
    {
      type: 'data-om-observation-start',
      data: {
        cycleId: 'reflect-cycle-001',
        operationType: 'reflection',
        startedAt: new Date().toISOString(),
        tokensToObserve: 41000,
        recordId: RECORD_ID,
        threadId: THREAD_ID,
        threadIds: [THREAD_ID],
        config: {
          messageTokens: 10000,
          observationTokensThreshold: 40000,
        },
      },
    },
    // Reflection completes
    {
      type: 'data-om-observation-end',
      data: {
        cycleId: 'reflect-cycle-001',
        operationType: 'reflection',
        completedAt: new Date().toISOString(),
        durationMs: 3500,
        tokensObserved: 41000,
        observationTokens: 12000,
        observations: '## Reflected Observations\n\n- Compressed observations here',
        recordId: RECORD_ID,
        threadId: THREAD_ID,
      },
    },
    {
      type: 'finish',
      finishReason: 'stop',
      usage: { inputTokens: 200, outputTokens: 100, totalTokens: 300 },
    },
  ],
];

/**
 * Fixture: Shared token budget behavior
 * Tests: Progress bars show shared budget, thresholds adjust dynamically
 */
export const omSharedBudgetFixture = [
  [
    { type: 'stream-start', warnings: [] },
    {
      type: 'response-metadata',
      id: 'resp_om_adaptive_001',
      timestamp: new Date().toISOString(),
      modelId: 'gpt-4o-mini',
    },
    // Status with shared token budget - observations are low, so message threshold is higher
    {
      type: 'data-om-status',
      data: {
        windows: {
          active: {
            messages: { tokens: 8000, threshold: 45000 },
            observations: { tokens: 500, threshold: 5000 },
          },
          buffered: {
            observations: {
              chunks: 0,
              messageTokens: 0,
              observationTokens: 0,
              projectedMessageRemoval: 0,
              status: 'idle' as const,
            },
            reflection: {
              observationTokens: 0,
              inputObservationTokens: 0,
              status: 'idle' as const,
            },
          },
        },
        recordId: RECORD_ID,
        threadId: THREAD_ID,
        stepNumber: 0,
        generationCount: 0,
      },
    },
    {
      type: 'text-start',
      id: 'msg_om_adaptive_001',
      providerMetadata: {},
    },
    { type: 'text-delta', id: 'msg_om_adaptive_001', delta: 'Adaptive' },
    { type: 'text-delta', id: 'msg_om_adaptive_001', delta: ' threshold' },
    { type: 'text-delta', id: 'msg_om_adaptive_001', delta: ' test' },
    { type: 'text-delta', id: 'msg_om_adaptive_001', delta: '.' },
    {
      type: 'finish',
      finishReason: 'stop',
      usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
    },
  ],
];
