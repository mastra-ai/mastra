import { getPineconeIndices } from '@mastra/core';

import KnowledgeSourceMultiSelect from './knowledge-source-multi-select';

export const AgentKnowledgeSource = async () => {
  const indexes = await getPineconeIndices();

  return <KnowledgeSourceMultiSelect indexes={indexes || []} />;
};
