import type { MastraScorer } from '@mastra/core/evals';
import type {
  StorageCreateScorerDefinitionInput,
  StorageUpdateScorerDefinitionInput,
  StorageListScorerDefinitionsInput,
  StorageListScorerDefinitionsOutput,
  StorageResolvedScorerDefinitionType,
  StorageListScorerDefinitionsResolvedOutput,
} from '@mastra/core/storage';

import type { MastraEditor } from '../index';

export class EditorScorerNamespace {
  constructor(private editor: MastraEditor) {}

  create(input: StorageCreateScorerDefinitionInput): Promise<StorageResolvedScorerDefinitionType> {
    return this.editor.createScorerDefinition(input);
  }

  getById(id: string): Promise<StorageResolvedScorerDefinitionType | null> {
    return this.editor.getScorerDefinition(id);
  }

  update(input: StorageUpdateScorerDefinitionInput): Promise<StorageResolvedScorerDefinitionType> {
    return this.editor.updateScorerDefinition(input);
  }

  delete(id: string): Promise<void> {
    return this.editor.deleteScorerDefinition(id);
  }

  list(args?: StorageListScorerDefinitionsInput): Promise<StorageListScorerDefinitionsOutput> {
    return this.editor.listScorerDefinitions(args);
  }

  listResolved(args?: StorageListScorerDefinitionsInput): Promise<StorageListScorerDefinitionsResolvedOutput> {
    return this.editor.listScorerDefinitionsResolved(args);
  }

  resolve(storedScorer: StorageResolvedScorerDefinitionType): MastraScorer<any, any, any, any> | null {
    return this.editor.createScorerFromStoredConfig(storedScorer);
  }
}
