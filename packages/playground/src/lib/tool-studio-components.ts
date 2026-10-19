import type { ToolStudioComponent } from '@mastra/playground-ui/domains/chat/tools/studio-components/studio-components-context';
import * as MastraReact from '@mastra/react';
import * as MastraReactChat from '@mastra/react/chat';
import * as HooksAgents from '@mastra/react/hooks/agents';
import * as HooksAuth from '@mastra/react/hooks/auth';
import * as HooksCapabilities from '@mastra/react/hooks/capabilities';
import * as HooksConfiguration from '@mastra/react/hooks/configuration';
import * as HooksDatasets from '@mastra/react/hooks/datasets';
import * as HooksEmbedders from '@mastra/react/hooks/embedders';
import * as HooksExperiments from '@mastra/react/hooks/experiments';
import * as HooksFeedback from '@mastra/react/hooks/feedback';
import * as HooksLlm from '@mastra/react/hooks/llm';
import * as HooksLogs from '@mastra/react/hooks/logs';
import * as HooksMcps from '@mastra/react/hooks/mcps';
import * as HooksMemory from '@mastra/react/hooks/memory';
import * as HooksMetrics from '@mastra/react/hooks/metrics';
import * as HooksProcessors from '@mastra/react/hooks/processors';
import * as HooksPromptBlocks from '@mastra/react/hooks/prompt-blocks';
import * as HooksQuery from '@mastra/react/hooks/query';
import * as HooksReview from '@mastra/react/hooks/review';
import * as HooksSchedules from '@mastra/react/hooks/schedules';
import * as HooksScores from '@mastra/react/hooks/scores';
import * as HooksTemplates from '@mastra/react/hooks/templates';
import * as HooksToolProviders from '@mastra/react/hooks/tool-providers';
import * as HooksTools from '@mastra/react/hooks/tools';
import * as HooksTraces from '@mastra/react/hooks/traces';
import * as HooksVectors from '@mastra/react/hooks/vectors';
import * as HooksVoice from '@mastra/react/hooks/voice';
import * as HooksWorkflows from '@mastra/react/hooks/workflows';
import * as HooksWorkspace from '@mastra/react/hooks/workspace';
import * as MastraReactUI from '@mastra/react/ui';
import * as ReactQuery from '@tanstack/react-query';
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import { withStudioBasePath } from './studio-base-path';

declare global {
  // Read by tool UI bundles built by `mastra dev` / `mastra build --studio` instead of bundling their own React.
  var __MASTRA_STUDIO_SHARED_MODULES__: Record<string, unknown> | undefined;
}

/**
 * Shares Studio's React, Mastra client and query cache with custom tool components so hooks and context work across
 * bundles. Keys must match the specifiers the deployer leaves external in tool UI builds.
 */
export function exposeStudioSharedModules() {
  globalThis.__MASTRA_STUDIO_SHARED_MODULES__ = {
    react: React,
    'react/jsx-runtime': jsxRuntime,
    'react-dom': ReactDOM,
    'react-dom/client': ReactDOMClient,
    '@mastra/react': MastraReact,
    '@mastra/react/chat': MastraReactChat,
    '@mastra/react/ui': MastraReactUI,
    '@mastra/react/hooks/agents': HooksAgents,
    '@mastra/react/hooks/auth': HooksAuth,
    '@mastra/react/hooks/capabilities': HooksCapabilities,
    '@mastra/react/hooks/configuration': HooksConfiguration,
    '@mastra/react/hooks/datasets': HooksDatasets,
    '@mastra/react/hooks/embedders': HooksEmbedders,
    '@mastra/react/hooks/experiments': HooksExperiments,
    '@mastra/react/hooks/feedback': HooksFeedback,
    '@mastra/react/hooks/llm': HooksLlm,
    '@mastra/react/hooks/logs': HooksLogs,
    '@mastra/react/hooks/mcps': HooksMcps,
    '@mastra/react/hooks/memory': HooksMemory,
    '@mastra/react/hooks/metrics': HooksMetrics,
    '@mastra/react/hooks/processors': HooksProcessors,
    '@mastra/react/hooks/prompt-blocks': HooksPromptBlocks,
    '@mastra/react/hooks/query': HooksQuery,
    '@mastra/react/hooks/review': HooksReview,
    '@mastra/react/hooks/schedules': HooksSchedules,
    '@mastra/react/hooks/scores': HooksScores,
    '@mastra/react/hooks/templates': HooksTemplates,
    '@mastra/react/hooks/tool-providers': HooksToolProviders,
    '@mastra/react/hooks/tools': HooksTools,
    '@mastra/react/hooks/traces': HooksTraces,
    '@mastra/react/hooks/vectors': HooksVectors,
    '@mastra/react/hooks/voice': HooksVoice,
    '@mastra/react/hooks/workflows': HooksWorkflows,
    '@mastra/react/hooks/workspace': HooksWorkspace,
    '@tanstack/react-query': ReactQuery,
  };
}

export function toolStudioComponentUrl(id: string): string {
  return new URL(withStudioBasePath(`/tool-ui/${id}.js`), window.location.origin).href;
}

export async function loadToolStudioComponent(id: string): Promise<ToolStudioComponent> {
  const module: { default: ToolStudioComponent } = await import(/* @vite-ignore */ toolStudioComponentUrl(id));
  return module.default;
}
