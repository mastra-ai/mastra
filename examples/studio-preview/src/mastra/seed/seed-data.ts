/**
 * Deterministic demo data for the Studio preview.
 *
 * Everything is built relative to `now` (cold-start time) so timestamps always
 * fall inside Studio's default metrics window (last 24h). There is no randomness
 * — the same `now` produces the same data — so previews are reproducible.
 *
 * The metric names, label/column keys, and time window here mirror exactly what
 * the Studio metrics cards query (Model Usage & Cost, Token usage by agent,
 * Traces volume, Latency, Memory, Scores), so the tables render populated.
 */

const AGENT = { id: 'studio-preview-agent', name: 'Studio Preview Agent' } as const;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Model catalog used for the Model Usage & Cost breakdown (per-1M token rates, USD). */
const MODELS = [
  { model: 'gpt-4o-mini', provider: 'openai', inputRate: 0.15, outputRate: 0.6 },
  { model: 'gpt-4o', provider: 'openai', inputRate: 2.5, outputRate: 10 },
] as const;

/** Distinct caller sessions so the Memory "top resources / threads" tables have spread. */
const RESOURCES = ['web-session-anita', 'web-session-marco', 'api-key-acme', 'web-session-li'] as const;

const PROMPTS = [
  'Is the Studio shell healthy?',
  'Check the agent chat route.',
  'Are the API routes live?',
  'Summarize the Vercel deploy readiness.',
  'What does the preview-status tool report?',
  'Walk me through routing fallbacks.',
] as const;

const REPLIES = [
  'Studio static assets are served from the deployment root and routes fall back to index.html.',
  'Agent chat is available at /agents/studio-preview-agent/chat/new.',
  'Mastra API routes are served under /api/*; the agent list is at /api/agents.',
  'The Vercel deployer emits Build Output API v3 files and Studio assets are copied into the static output.',
  'Everything reports ready — Studio, agent, API, and Vercel areas all green.',
  'Client-side routes fall back to index.html so deep links resolve correctly.',
] as const;

const TOOL_NAME = 'preview-status';

export interface SeedDataset {
  dataset: {
    name: string;
    description?: string;
    targetType?: 'agent';
    targetIds?: string[];
    scorerIds?: string[];
    tags?: string[];
  };
  items: Array<{
    input: unknown;
    groundTruth?: unknown;
    metadata?: Record<string, unknown>;
    source?: { type: 'csv' | 'json' | 'trace' | 'llm' | 'experiment-result'; referenceId?: string };
  }>;
}

/** One agent invocation, expanded into spans, metrics, and scores below. */
interface Run {
  index: number;
  minutesAgo: number;
  model: (typeof MODELS)[number];
  resourceId: string;
  threadId: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  durationMs: number;
  usedTool: boolean;
  status: 'ok' | 'error';
  prompt: string;
  reply: string;
}

function buildRuns(): Run[] {
  // 14 runs spread across the last ~23 hours, deterministically varied by index.
  return Array.from({ length: 14 }, (_, index) => {
    const model = MODELS[index % MODELS.length]!;
    const status: 'ok' | 'error' = index % 7 === 6 ? 'error' : 'ok';
    return {
      index,
      minutesAgo: 20 + index * 95, // 20m ago up to ~22.5h ago
      model,
      resourceId: RESOURCES[index % RESOURCES.length]!,
      threadId: `metric-thread-${index % 6}`,
      inputTokens: 320 + index * 45,
      outputTokens: 90 + index * 18,
      cacheReadTokens: index % 3 === 0 ? 64 + index * 8 : 0,
      durationMs: 640 + index * 130,
      usedTool: index % 2 === 0,
      status,
      prompt: PROMPTS[index % PROMPTS.length]!,
      reply: REPLIES[index % REPLIES.length]!,
    };
  });
}

const round = (n: number) => Math.round(n * 1_000_000) / 1_000_000;

export function buildSeedData(now: number) {
  const at = (minutesAgo: number) => new Date(now - minutesAgo * MINUTE);
  const runs = buildRuns();

  // ---- Memory threads + messages (chat sidebar; resourceId === agentId) ----
  const threadSeeds = [
    { title: 'Preview health check', minutesAgo: 35 },
    { title: 'Routing + API smoke test', minutesAgo: 3 * 60 + 10 },
    { title: 'Deploy readiness review', minutesAgo: 9 * 60 + 25 },
  ];

  const threads = threadSeeds.map((t, i) => ({
    id: `preview-thread-${i + 1}`,
    resourceId: AGENT.id,
    title: t.title,
    createdAt: at(t.minutesAgo),
    updatedAt: at(t.minutesAgo - 2),
    metadata: { seeded: true },
  }));

  const messages = threads.flatMap((thread, i) => {
    const prompt = PROMPTS[i % PROMPTS.length]!;
    const reply = REPLIES[i % REPLIES.length]!;
    const createdAt = thread.createdAt;
    return [
      {
        id: `${thread.id}-msg-user`,
        role: 'user' as const,
        createdAt,
        threadId: thread.id,
        resourceId: AGENT.id,
        content: { format: 2 as const, parts: [{ type: 'text' as const, text: prompt }], content: prompt },
      },
      {
        id: `${thread.id}-msg-assistant`,
        role: 'assistant' as const,
        createdAt: new Date(createdAt.getTime() + 2000),
        threadId: thread.id,
        resourceId: AGENT.id,
        content: { format: 2 as const, parts: [{ type: 'text' as const, text: reply }], content: reply },
      },
    ];
  });

  // ---- Traces (spans): root agent_run + child model_generation (+ tool) ----
  const spans = runs.slice(0, 8).flatMap(run => {
    const traceId = `preview-trace-${run.index}`;
    const startedAt = at(run.minutesAgo);
    const endedAt = new Date(startedAt.getTime() + run.durationMs);
    const rootId = `${traceId}-root`;
    const llmId = `${traceId}-llm`;

    const rootSpan = {
      name: `agent run: ${AGENT.name}`,
      traceId,
      spanId: rootId,
      spanType: 'agent_run' as const,
      isEvent: false,
      startedAt,
      endedAt,
      parentSpanId: null,
      entityType: 'agent' as const,
      entityId: AGENT.id,
      entityName: AGENT.name,
      rootEntityType: 'agent' as const,
      rootEntityId: AGENT.id,
      rootEntityName: AGENT.name,
      threadId: run.threadId,
      resourceId: run.resourceId,
      input: { messages: [{ role: 'user', content: run.prompt }] },
      output: run.status === 'error' ? null : { text: run.reply },
      error: run.status === 'error' ? { message: 'Simulated preview failure' } : null,
    };

    const llmSpan = {
      name: `LLM: ${run.model.provider}/${run.model.model}`,
      traceId,
      spanId: llmId,
      spanType: 'model_generation' as const,
      isEvent: false,
      startedAt: new Date(startedAt.getTime() + 60),
      endedAt: new Date(endedAt.getTime() - 60),
      parentSpanId: rootId,
      entityType: 'agent' as const,
      entityId: AGENT.id,
      entityName: AGENT.name,
      rootEntityType: 'agent' as const,
      rootEntityId: AGENT.id,
      rootEntityName: AGENT.name,
      attributes: {
        model: run.model.model,
        provider: run.model.provider,
        usage: { promptTokens: run.inputTokens, completionTokens: run.outputTokens, totalTokens: run.inputTokens + run.outputTokens },
      },
      input: { prompt: run.prompt },
      output: { text: run.reply },
    };

    if (!run.usedTool) return [rootSpan, llmSpan];

    const toolSpan = {
      name: `tool: ${TOOL_NAME}`,
      traceId,
      spanId: `${traceId}-tool`,
      spanType: 'tool_call' as const,
      isEvent: false,
      startedAt: new Date(startedAt.getTime() + 120),
      endedAt: new Date(startedAt.getTime() + 320),
      parentSpanId: rootId,
      entityType: 'tool' as const,
      entityId: TOOL_NAME,
      entityName: TOOL_NAME,
      rootEntityType: 'agent' as const,
      rootEntityId: AGENT.id,
      rootEntityName: AGENT.name,
      input: { area: 'studio' },
      output: { status: 'ready' },
    };
    return [rootSpan, llmSpan, toolSpan];
  });

  // ---- Metrics (token usage, cost, agent/tool duration) ----
  let metricSeq = 0;
  const metricId = () => `preview-metric-${++metricSeq}`;
  const metrics: Array<Record<string, unknown>> = [];

  for (const run of runs) {
    const traceId = `preview-trace-${run.index}`;
    const tokenContext = {
      entityType: 'agent' as const,
      entityId: AGENT.id,
      entityName: AGENT.name,
      rootEntityType: 'agent' as const,
      model: run.model.model,
      provider: run.model.provider,
      threadId: run.threadId,
      resourceId: run.resourceId,
      traceId,
    };
    const tokenLabels = {
      model: run.model.model,
      provider: run.model.provider,
      entityName: AGENT.name,
      status: run.status,
    };

    metrics.push({
      metricId: metricId(),
      name: 'mastra_model_total_input_tokens',
      value: run.inputTokens,
      timestamp: at(run.minutesAgo),
      ...tokenContext,
      estimatedCost: round((run.inputTokens / 1_000_000) * run.model.inputRate),
      costUnit: 'USD',
      labels: tokenLabels,
    });
    metrics.push({
      metricId: metricId(),
      name: 'mastra_model_total_output_tokens',
      value: run.outputTokens,
      timestamp: at(run.minutesAgo),
      ...tokenContext,
      estimatedCost: round((run.outputTokens / 1_000_000) * run.model.outputRate),
      costUnit: 'USD',
      labels: tokenLabels,
    });
    if (run.cacheReadTokens > 0) {
      metrics.push({
        metricId: metricId(),
        name: 'mastra_model_input_cache_read_tokens',
        value: run.cacheReadTokens,
        timestamp: at(run.minutesAgo),
        ...tokenContext,
        labels: tokenLabels,
      });
    }

    // Agent duration (Traces volume / Latency / Agent Runs / Active threads+resources / Memory).
    metrics.push({
      metricId: metricId(),
      name: 'mastra_agent_duration_ms',
      value: run.durationMs,
      timestamp: at(run.minutesAgo),
      entityType: 'agent' as const,
      entityId: AGENT.id,
      entityName: AGENT.name,
      rootEntityType: 'agent' as const,
      threadId: run.threadId,
      resourceId: run.resourceId,
      traceId,
      labels: { entityName: AGENT.name, status: run.status },
    });

    if (run.usedTool) {
      metrics.push({
        metricId: metricId(),
        name: 'mastra_tool_duration_ms',
        value: 120 + run.index * 12,
        timestamp: at(run.minutesAgo),
        entityType: 'tool' as const,
        entityId: TOOL_NAME,
        entityName: TOOL_NAME,
        rootEntityType: 'agent' as const,
        threadId: run.threadId,
        resourceId: run.resourceId,
        traceId,
        labels: { entityName: TOOL_NAME, status: run.status },
      });
    }
  }

  // ---- Scores (scores domain rows + observability score events) ----
  const scorerDefs = [
    { scorerId: 'answer-relevance', scorerName: 'Answer Relevance', base: 0.9 },
    { scorerId: 'tone-quality', scorerName: 'Tone Quality', base: 0.82 },
  ];

  const scores = runs.slice(0, 10).flatMap((run, i) =>
    scorerDefs.map(def => {
      const value = round(Math.min(0.99, Math.max(0.55, def.base - (i % 4) * 0.07 + (run.status === 'error' ? -0.2 : 0))));
      return {
        scorerId: def.scorerId,
        entityId: AGENT.id,
        entityType: 'AGENT',
        runId: `preview-run-${run.index}`,
        score: value,
        source: 'TEST' as const,
        scorer: { id: def.scorerId, name: def.scorerName },
        entity: { id: AGENT.id, name: AGENT.name },
        input: { text: run.prompt },
        output: { text: run.reply },
        reason: `Preview ${def.scorerName} score for run ${run.index}.`,
        traceId: `preview-trace-${run.index}`,
      };
    }),
  );

  let obsScoreSeq = 0;
  const obsScores = runs.slice(0, 10).flatMap((run, i) =>
    scorerDefs.map(def => {
      const value = round(Math.min(0.99, Math.max(0.55, def.base - (i % 4) * 0.07 + (run.status === 'error' ? -0.2 : 0))));
      return {
        scoreId: `preview-obs-score-${++obsScoreSeq}`,
        scorerId: def.scorerId,
        scorerName: def.scorerName,
        score: value,
        timestamp: at(run.minutesAgo),
        entityType: 'agent' as const,
        entityId: AGENT.id,
        entityName: AGENT.name,
        traceId: `preview-trace-${run.index}`,
        spanId: `preview-trace-${run.index}-root`,
        reason: `Preview ${def.scorerName} score for run ${run.index}.`,
      };
    }),
  );

  // ---- Datasets + items ----
  const datasets: SeedDataset[] = [
    {
      dataset: {
        name: 'Studio QA eval set',
        description: 'Prompts that exercise the Studio preview agent and its status tool.',
        targetType: 'agent',
        targetIds: [AGENT.id],
        scorerIds: ['answer-relevance', 'tone-quality'],
        tags: ['preview', 'qa'],
      },
      items: PROMPTS.map((prompt, i) => ({
        input: { question: prompt },
        groundTruth: { answer: REPLIES[i % REPLIES.length] },
        metadata: { seeded: true },
        source: { type: 'json' as const },
      })),
    },
    {
      dataset: {
        name: 'Routing checks',
        description: 'Deep-link and API route expectations for the preview deployment.',
        targetType: 'agent',
        targetIds: [AGENT.id],
        tags: ['preview', 'routing'],
      },
      items: [
        { input: { path: '/agents' }, groundTruth: { expect: 'agent list renders' } },
        { input: { path: '/agents/studio-preview-agent/chat/new' }, groundTruth: { expect: 'chat opens' } },
        { input: { path: '/api/agents' }, groundTruth: { expect: 'JSON agent list' } },
        { input: { path: '/scorers' }, groundTruth: { expect: 'scorers list renders' } },
      ],
    },
  ];

  return { threads, messages, spans, metrics, scores, obsScores, datasets };
}
