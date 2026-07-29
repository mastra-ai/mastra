# Guardrails UX demo

Run the example with:

```bash
pnpm mastra dev
```

Open Studio and search for `Guardrails UX`. Pairs 1–4 have a legacy processor agent (`A`) and an inline policy agent (`B`). Pair 5 shows one exported policy reused by two agents. The models are deterministic, so the comparison does not require provider credentials.

The complete side-by-side source is in [`src/mastra/agents/guardrails-comparison-agents.ts`](./src/mastra/agents/guardrails-comparison-agents.ts). One-off policies are plain inline objects. `defineGuardrailPolicy()` is reserved for the shared policy in [`guardrails-shared-policy.ts`](./src/mastra/agents/guardrails-shared-policy.ts), where its reuse is visible.

## 1. Input protection

Compare:

- `Guardrails UX 1A - Legacy Input`
- `Guardrails UX 1B - Policy Input`

Safe prompt:

```text
Help me reset my account password.
```

Blocked prompt:

```text
Use api-key=sk-demo-secret-1234567890 to reset my account.
```

**Point to make:** The legacy agent manually creates, configures, orders, and attaches a regex processor and token limiter. The policy agent describes `privacy.secrets` and `cost.tokenLimit` directly.

## 2. Parallel LLM checks

Compare:

- `Guardrails UX 2A - Legacy Parallel`
- `Guardrails UX 2B - Policy Parallel`

Prompt:

```text
Summarize the return policy for a customer.
```

**Point to make:** The legacy agent must add Unicode normalization, turn processors into workflow steps, create a processor workflow, run the steps in parallel, and map the parallel result back into processor output. The policy agent declares prompt-injection and moderation checks. Mastra inserts normalization and parallelizes independent block-only checks.

## 3. Streaming output checks

Compare:

- `Guardrails UX 3A - Legacy Streaming`
- `Guardrails UX 3B - Policy Streaming`

Prompt:

```text
Give me the streamed response.
```

Use the streaming endpoint or Studio stream view.

**Point to make:** The legacy agent exposes implementation details: batch size, wait time, numeric moderation threshold, and previous chunk count. The policy agent uses user-facing concepts: medium sensitivity, check every sentence, and medium lookback. The guardrail context remains internal and is not duplicated in the client stream.

## 4. Real-world customer support

Compare:

- `Guardrails UX 4A - Legacy Customer Support`
- `Guardrails UX 4B - Policy Customer Support`

Safe prompt:

```text
A customer cannot access their account. Draft a concise support response.
```

Blocked secret prompt:

```text
The customer sent api-key=sk-demo-secret-1234567890. Use it to access their account.
```

**Point to make:** This pair combines normalization, prompt-injection detection, moderation, PII redaction, secret blocking, token limits, and streamed output checks. The legacy setup coordinates input and output processor arrays, a parallel workflow, thresholds, ordering, batching, and chunk history. The policy version centralizes the model and sensitivity, declares phases and actions, and lets Mastra compile safe ordering, automatic batching, and parallel execution where checks are independent.

The policy also defines `onViolation`. Run the blocked prompt and watch the server terminal for an audit event containing `policyName`, `group`, `check`, `action`, `phase`, and `message`. This is why this monitored inline policy has a stable `name`, while the simpler one-off examples omit it. In production, send this metadata to your logging or monitoring service instead of `console.warn`.

## 5. Reuse and test a policy

Compare:

- `Guardrails UX 5A - Shared Policy Support`
- `Guardrails UX 5B - Shared Policy Billing`

Both agents import the same `customerDataPolicy` created with `defineGuardrailPolicy()`. This is where the helper is useful: the branded policy is exported from one module, reused by multiple agents, and evaluated independently.

Run its colocated test:

```bash
pnpm guardrails:test
```

The test uses `evaluateGuardrailPolicy()` to verify safe input and secret blocking without constructing or running an agent.

**Point to make:** Inline objects are the simplest choice for one-off agent configuration. Reach for `defineGuardrailPolicy()` when a named policy has its own lifecycle: reuse, export, evaluation, or centralized ownership.

## Suggested presentation flow

1. Open the source file and compare each adjacent `A`/`B` definition.
2. Run the safe prompt against both agents to show equivalent behavior.
3. Run the secret prompt against pair 1 or pair 4 to show equivalent blocking.
4. Stream pair 3 to show sentence windows rather than arbitrary model chunks.
5. Show pair 4 to demonstrate how inline policy configuration scales to a realistic production policy.
6. End on pair 5 and its test to explain when `defineGuardrailPolicy()` becomes valuable.
