import type { Writable } from 'node:stream';
import type { FullOutput, MastraModelOutput } from '../stream/base/output';
import { buildInterruptedEnvelope, formatJson, formatStreamJson, formatText, hasWarnings } from './output-formatter';
import type { OutputFormat } from './output-formatter';

const EXIT_SUCCESS = 0;
const EXIT_RUNTIME_ERROR = 1;
const EXIT_CONFIG_ERROR = 2;

const VALID_FORMATS: readonly OutputFormat[] = ['text', 'json', 'stream-json'];

export interface RunHeadlessOptions {
  prompt: string;
  agentId: string;
  outputFormat: OutputFormat;
  jsonSchema?: string;
  strict: boolean;
}

export interface RunHeadlessIO {
  stdout: Writable;
  stderr: Writable;
  exit: (code: number) => void;
  onSigint: (handler: () => void) => void;
}

interface MinimalAgent {
  stream(
    messages: Array<{ role: 'user'; content: string }>,
    options?: { structuredOutput?: { schema: unknown } },
  ): Promise<MastraModelOutput<any>>;
}

interface MinimalMastra {
  getAgent(id: string): MinimalAgent;
  getAgents?(): Record<string, unknown>;
}

export async function runHeadless(
  mastra: MinimalMastra,
  options: RunHeadlessOptions,
  io: RunHeadlessIO,
): Promise<void> {
  const { prompt, agentId, outputFormat, jsonSchema, strict } = options;

  if (!VALID_FORMATS.includes(outputFormat)) {
    io.stderr.write(`Error: Invalid outputFormat "${outputFormat}". Must be one of: ${VALID_FORMATS.join(', ')}.\n`);
    io.exit(EXIT_CONFIG_ERROR);
    return;
  }

  let agent: MinimalAgent;
  try {
    agent = mastra.getAgent(agentId);
  } catch {
    io.stderr.write(`Error: Agent ${JSON.stringify(agentId)} not found.\n`);
    const agentKeys = Object.keys(mastra.getAgents?.() ?? {});
    if (agentKeys.length > 0) {
      io.stderr.write(`Available agents: ${agentKeys.join(', ')}\n`);
    }
    io.exit(EXIT_CONFIG_ERROR);
    return;
  }

  let structuredOutput: { schema: unknown } | undefined;
  if (jsonSchema) {
    try {
      structuredOutput = { schema: JSON.parse(jsonSchema) };
    } catch (e) {
      io.stderr.write(`Error: Invalid --json-schema: ${(e as Error).message}\n`);
      io.exit(EXIT_CONFIG_ERROR);
      return;
    }
  }

  const startTime = Date.now();

  const streamOutput = await agent.stream([{ role: 'user', content: prompt }], {
    ...(structuredOutput ? { structuredOutput } : {}),
  });

  registerSigint(outputFormat, io, startTime);

  let fullOutput: FullOutput<any>;
  if (outputFormat === 'text') {
    fullOutput = await formatText(streamOutput, io.stdout, io.stderr);
  } else if (outputFormat === 'json') {
    fullOutput = await formatJson(streamOutput, io.stdout, startTime);
  } else {
    fullOutput = await formatStreamJson(streamOutput, io.stdout, io.stderr);
  }

  if (fullOutput.error) {
    io.exit(EXIT_RUNTIME_ERROR);
    return;
  }
  if (strict && hasWarnings(fullOutput)) {
    io.stderr.write('Warnings treated as errors (--strict):\n');
    for (const w of fullOutput.warnings) {
      io.stderr.write(`  ${JSON.stringify(w)}\n`);
    }
    io.exit(EXIT_RUNTIME_ERROR);
    return;
  }
  io.exit(EXIT_SUCCESS);
}

function registerSigint(outputFormat: OutputFormat, io: RunHeadlessIO, startTime: number): void {
  io.onSigint(() => {
    if (outputFormat === 'text') {
      io.stdout.write('\n');
    } else if (outputFormat === 'json') {
      const envelope = buildInterruptedEnvelope(Date.now() - startTime);
      io.stdout.write(JSON.stringify(envelope) + '\n');
    } else {
      io.stdout.write(JSON.stringify({ type: 'abort', payload: { reason: 'interrupted' } }) + '\n');
    }
    io.exit(EXIT_RUNTIME_ERROR);
  });
}
