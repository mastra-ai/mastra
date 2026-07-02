import { Agent } from '@mastra/core/agent';
import type { ModelRouterModelId } from '@mastra/core/llm';
import { Memory } from '@mastra/memory';
import { MODEL_TOKENS } from '../../../../../docs/src/plugins/remark-model-tokens/models';
import { previewScorers } from '../scorers/preview-scorers';
import { storage } from '../store';
import { previewStatusTool } from '../tools/preview-status';

function resolvePreviewModel() {
  if (process.env.MASTRA_PREVIEW_MODEL) {
    return MODEL_TOKENS[process.env.MASTRA_PREVIEW_MODEL] ?? process.env.MASTRA_PREVIEW_MODEL;
  }

  if (process.env.OPENAI_API_KEY) return MODEL_TOKENS.__GATEWAY_OPENAI_MODEL_BASE__;
  if (process.env.ANTHROPIC_API_KEY) return MODEL_TOKENS.__GATEWAY_ANTHROPIC_MODEL_SONNET__;

  return MODEL_TOKENS.__GATEWAY_OPENAI_MODEL_BASE__;
}

const model = resolvePreviewModel() as ModelRouterModelId;

export const studioPreviewAgent = new Agent({
  id: 'studio-preview-agent',
  name: 'Studio Preview Agent',
  description: 'A small agent for validating Mastra Studio PR previews on Vercel.',
  instructions: `
You are a concise product QA assistant for Mastra Studio preview deployments.
Help reviewers verify that the Studio shell, agent chat, and tool execution paths are working.
Use the preview status tool when a reviewer asks about preview health, routing, or deployment readiness.
`,
  model,
  tools: {
    previewStatusTool,
  },
  // Memory is enabled (history only, no semantic recall) so the chat thread
  // sidebar reports memory as available and the seeded threads show up. Live
  // chats also persist to the same shared in-memory store.
  memory: new Memory({
    storage,
    options: {
      lastMessages: 20,
      semanticRecall: false,
    },
  }),
  // Deterministic scorers so live runs produce scores without an LLM judge.
  scorers: {
    'answer-relevance': { scorer: previewScorers['answer-relevance'] },
    'tone-quality': { scorer: previewScorers['tone-quality'] },
  },
});

/**
 * Code-defined agent whose instructions and tools may be overridden from the
 * Studio editor. Registering `MastraEditor` (see `../index.ts`) flips the editor
 * capability on for the preview, so reviewers can open this agent, see the
 * "Editor" capability in the sidebar footer, and exercise the versioning flow.
 */
export const editorShowcaseAgent = new Agent({
  id: 'editor-showcase-agent',
  name: 'Editor Showcase Agent',
  description: 'Code-defined agent that Studio may override (instructions + tools) to demo the editor.',
  instructions: `
You are a small demo agent for the Mastra Studio editor.
Reviewers can edit these instructions and your tools from the editor to try the save/publish versioning flow.
`,
  model,
  tools: {
    previewStatusTool,
  },
  editor: { instructions: true, tools: true },
});
