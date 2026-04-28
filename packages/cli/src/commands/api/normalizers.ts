import type { ApiCommandDescriptor } from './commands.js';

const WORKFLOW_STATUS_MAP: Record<string, string> = {
  completed: 'success',
  complete: 'success',
  success: 'success',
  succeeded: 'success',
  failed: 'failed',
  failure: 'failed',
  error: 'failed',
  canceled: 'cancelled',
  cancelled: 'cancelled',
  running: 'running',
  pending: 'running',
  suspended: 'suspended',
  waiting: 'suspended',
};

export function normalizeData(descriptor: ApiCommandDescriptor, data: unknown): unknown {
  if (descriptor.key === 'agentRun' && data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    return pruneUndefined({
      text: record.text ?? record.result ?? record.output,
      structuredOutput: record.structuredOutput ?? record.object,
      usage: record.usage ?? record.totalUsage,
      toolCalls: record.toolCalls,
      toolResults: record.toolResults,
      finishReason: record.finishReason,
      runId: record.runId,
      traceId: record.traceId,
      spanId: record.spanId,
    });
  }

  if (descriptor.key === 'toolGet' && data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    return {
      inputSchema: record.inputSchema ?? record.parameters ?? record.input,
      ...record,
    };
  }

  if (descriptor.key.startsWith('workflowRun')) {
    return normalizeWorkflowStatus(data);
  }

  return data;
}

function pruneUndefined(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function normalizeWorkflowStatus(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(item => normalizeWorkflowStatus(item));
  if (!data || typeof data !== 'object') return data;

  const record = data as Record<string, unknown>;
  const status = typeof record.status === 'string' ? WORKFLOW_STATUS_MAP[record.status.toLowerCase()] : undefined;

  const normalizedRecord = Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.map(item => normalizeWorkflowStatus(item)) : value,
    ]),
  );

  return {
    ...normalizedRecord,
    ...(status ? { status } : {}),
  };
}
