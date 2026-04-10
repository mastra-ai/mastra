export * from './types';
export { BackgroundTaskManager } from './manager';
export { createBackgroundTask } from './create';
export { resolveBackgroundConfig } from './resolve-config';
export type { ResolvedBackgroundConfig } from './resolve-config';
export { backgroundOverrideJsonSchema, backgroundOverrideZodSchema } from './schema-injection';
export { generateBackgroundTaskSystemPrompt } from './system-prompt';
