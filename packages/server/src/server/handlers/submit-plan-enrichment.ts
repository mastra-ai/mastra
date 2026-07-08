import fs from 'node:fs/promises';
import path from 'node:path';

const LOCAL_PLAN_DIR = ['.mastracode', 'plans'];

interface SubmitPlanEnrichmentOptions {
  projectRoot?: string;
}

interface SubmitPlanFile {
  title: string;
  plan: string;
}

const getProjectRoot = (projectRoot?: string) =>
  path.resolve(
    projectRoot ?? process.env.MASTRA_SUBMIT_PLAN_PROJECT_ROOT ?? process.env.MASTRA_PROJECT_ROOT ?? process.cwd(),
  );

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const resolvePlanPath = (submittedPath: string, projectRoot?: string): string | undefined => {
  const root = getProjectRoot(projectRoot);
  const target = path.isAbsolute(submittedPath) ? path.resolve(submittedPath) : path.resolve(root, submittedPath);

  if (path.extname(target).toLowerCase() !== '.md') {
    return undefined;
  }

  const plansDir = path.resolve(root, ...LOCAL_PLAN_DIR);
  const relative = path.relative(plansDir, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || relative.includes(path.sep)) {
    return undefined;
  }

  return target;
};

const parsePlanFile = (raw: string): SubmitPlanFile => {
  const lines = raw.split(/\r?\n/);
  const headingIndex = lines.findIndex(line => line.trim().length > 0);
  const heading = headingIndex >= 0 ? lines[headingIndex] : undefined;

  if (heading?.startsWith('# ')) {
    return {
      title: heading.slice(2).trim(),
      plan: lines
        .slice(headingIndex + 1)
        .join('\n')
        .replace(/^\n+/, '')
        .trimEnd(),
    };
  }

  return { title: '', plan: raw.trimEnd() };
};

const readPlanFile = async (absPath: string): Promise<SubmitPlanFile | undefined> => {
  try {
    return parsePlanFile(await fs.readFile(absPath, 'utf-8'));
  } catch {
    return undefined;
  }
};

export const enrichSubmitPlanSuspendPayload = async (
  suspendPayload: unknown,
  options: SubmitPlanEnrichmentOptions = {},
): Promise<unknown> => {
  if (!isRecord(suspendPayload)) {
    return suspendPayload;
  }

  const submittedPath = suspendPayload.path;
  if (typeof submittedPath !== 'string' || submittedPath.length === 0) {
    return suspendPayload;
  }

  if (typeof suspendPayload.plan === 'string' && suspendPayload.plan.length > 0) {
    return suspendPayload;
  }

  const absPath = resolvePlanPath(submittedPath, options.projectRoot);
  if (!absPath) {
    return suspendPayload;
  }

  const file = await readPlanFile(absPath);
  if (!file) {
    return suspendPayload;
  }

  return {
    ...suspendPayload,
    ...(typeof suspendPayload.title === 'string' && suspendPayload.title.length > 0
      ? { title: suspendPayload.title }
      : file.title
        ? { title: file.title }
        : {}),
    plan: file.plan,
  };
};

export const enrichSubmitPlanStreamChunk = async <T>(
  chunk: T,
  options: SubmitPlanEnrichmentOptions = {},
): Promise<T> => {
  if (!isRecord(chunk) || chunk.type !== 'tool-call-suspended' || !isRecord(chunk.payload)) {
    return chunk;
  }

  if (chunk.payload.toolName !== 'submit_plan') {
    return chunk;
  }

  const enrichedSuspendPayload = await enrichSubmitPlanSuspendPayload(chunk.payload.suspendPayload, options);
  if (enrichedSuspendPayload === chunk.payload.suspendPayload) {
    return chunk;
  }

  return {
    ...chunk,
    payload: {
      ...chunk.payload,
      suspendPayload: enrichedSuspendPayload,
    },
  } as T;
};

export const enrichSubmitPlanStream = <T>(
  stream: ReadableStream<T>,
  options: SubmitPlanEnrichmentOptions = {},
): ReadableStream<T> =>
  stream.pipeThrough(
    new TransformStream<T, T>({
      async transform(chunk, controller) {
        controller.enqueue(await enrichSubmitPlanStreamChunk(chunk, options));
      },
    }),
  );

const enrichSuspendedToolMetadata = async (
  value: unknown,
  options: SubmitPlanEnrichmentOptions,
): Promise<{ value: unknown; changed: boolean }> => {
  if (!isRecord(value) || value.toolName !== 'submit_plan') {
    return { value, changed: false };
  }

  const enrichedSuspendPayload = await enrichSubmitPlanSuspendPayload(value.suspendPayload, options);
  if (enrichedSuspendPayload === value.suspendPayload) {
    return { value, changed: false };
  }

  return {
    value: {
      ...value,
      suspendPayload: enrichedSuspendPayload,
    },
    changed: true,
  };
};

export const enrichSubmitPlanMessage = async <T>(message: T, options: SubmitPlanEnrichmentOptions = {}): Promise<T> => {
  if (!isRecord(message) || !isRecord(message.content) || !isRecord(message.content.metadata)) {
    return message;
  }

  const suspendedTools = message.content.metadata.suspendedTools;
  if (!isRecord(suspendedTools)) {
    return message;
  }

  const entries = await Promise.all(
    Object.entries(suspendedTools).map(async ([key, value]) => {
      const enriched = await enrichSuspendedToolMetadata(value, options);
      return [key, enriched.value, enriched.changed] as const;
    }),
  );

  if (!entries.some(([, , changed]) => changed)) {
    return message;
  }

  return {
    ...message,
    content: {
      ...message.content,
      metadata: {
        ...message.content.metadata,
        suspendedTools: Object.fromEntries(entries.map(([key, value]) => [key, value])),
      },
    },
  } as T;
};

export const enrichSubmitPlanMessages = async <T>(
  messages: T[],
  options: SubmitPlanEnrichmentOptions = {},
): Promise<T[]> => Promise.all(messages.map(message => enrichSubmitPlanMessage(message, options)));
