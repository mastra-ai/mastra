import { Mastra, IMastraEditor, MastraEditorConfig } from '@mastra/core';

import type { Logger } from '@mastra/core';

import {
  EditorAgentNamespace,
  EditorMCPNamespace,
  EditorPromptNamespace,
  EditorScorerNamespace,
} from './namespaces';

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

  public readonly agent: EditorAgentNamespace;
  public readonly mcp: EditorMCPNamespace;
  public readonly prompt: EditorPromptNamespace;
  public readonly scorer: EditorScorerNamespace;

  constructor(config?: MastraEditorConfig) {
    this.__logger = config?.logger;
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
}
