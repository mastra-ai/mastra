import { fetchPineconeIndexes } from '@/domains/rag/actions';

import KnowledgeSourceMultiSelect from './knowledge-source-multi-select';

export const AgentKnowledgeSource = async () => {
  const indexes = await fetchPineconeIndexes();

  return <KnowledgeSourceMultiSelect indexes={indexes || []} />;
};
