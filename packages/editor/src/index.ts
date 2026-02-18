import { Mastra } from '@mastra/core';
import type { IMastraEditor, MastraEditorConfig } from '@mastra/core/editor';
import type { IMastraLogger as Logger } from '@mastra/core/logger';
import { BUILT_IN_PROCESSOR_PROVIDERS } from '@mastra/core/processor-provider';
import type { ProcessorProvider } from '@mastra/core/processor-provider';
import type { ToolProvider } from '@mastra/core/tool-provider';

import { EditorAgentNamespace, EditorMCPNamespace, EditorPromptNamespace, EditorScorerNamespace } from './namespaces';

export type { MastraEditorConfig };

export { renderTemplate } from './template-engine';
export { evaluateRuleGroup } from './rule-evaluator';
export { resolveInstructionBlocks } from './instruction-builder';
export {
  EditorNamespace,
  CrudEditorNamespace,
  EditorAgentNamespace,
  EditorMCPNamespace,
  EditorPromptNamespace,
  EditorScorerNamespace,
} from './namespaces';
export type { StorageAdapter } from './namespaces';

export class MastraEditor implements IMastraEditor {
  /** @internal — exposed for namespace classes, not part of public API */
  __mastra?: Mastra;
  /** @internal — exposed for namespace classes, not part of public API */
  __logger?: Logger;

  private __toolProviders: Record<string, ToolProvider>;
  private __processorProviders: Record<string, ProcessorProvider>;

  public readonly agent: EditorAgentNamespace;
  public readonly mcp: EditorMCPNamespace;
  public readonly prompt: EditorPromptNamespace;
  public readonly scorer: EditorScorerNamespace;

  constructor(config?: MastraEditorConfig) {
    this.__logger = config?.logger;
    this.__toolProviders = config?.toolProviders ?? {};
    this.__processorProviders = { ...BUILT_IN_PROCESSOR_PROVIDERS, ...config?.processorProviders };
    this.agent = new EditorAgentNamespace(this);
    this.mcp = new EditorMCPNamespace(this);
    this.prompt = new EditorPromptNamespace(this);
    this.scorer = new EditorScorerNamespace(this);
  }

  /**
   * Register this editor with a Mastra instance.
   * This gives the editor access to Mastra's storage, tools, workflows, etc.
   */
  registerWithMastra(mastra: Mastra): void {
    this.__mastra = mastra;
    if (!this.__logger) {
      this.__logger = mastra.getLogger();
    }
  }

  /** Registered tool providers */
  getToolProvider(id: string): ToolProvider | undefined {
    return this.__toolProviders[id];
  }

  /** List all registered tool providers */
  getToolProviders(): Record<string, ToolProvider> {
    return this.__toolProviders;
  }

  /** Get a processor provider by ID */
  getProcessorProvider(id: string): ProcessorProvider | undefined {
    return this.__processorProviders[id];
  }

  /** List all registered processor providers */
  listProcessorProviders(): Record<string, ProcessorProvider> {
    return this.__processorProviders;
  }
}
