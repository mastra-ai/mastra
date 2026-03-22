export * from './types';
export { BackgroundTaskManager } from './manager';
export { resolveBackgroundConfig } from './resolve-config';
export type { ResolvedBackgroundConfig } from './resolve-config';
export { injectBackgroundSchema, isBackgroundEligible, backgroundOverrideJsonSchema } from './schema-injection';
export { generateBackgroundTaskSystemPrompt } from './system-prompt';
