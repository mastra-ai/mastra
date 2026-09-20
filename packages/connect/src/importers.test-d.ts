import type { KnowledgeImportersInput } from '@mastra/core/knowledge';

import type { ImportersResolver } from './importers.js';

declare const resolver: ImportersResolver;

const asImportersInput: KnowledgeImportersInput = resolver;
void asImportersInput;
