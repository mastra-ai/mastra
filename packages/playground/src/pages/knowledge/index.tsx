import {
  MainContentLayout,
  Header,
  HeaderTitle,
  HeaderAction,
  Icon,
  Button,
  DocsIcon,
  PageHeader,
  KnowledgeTable,
  CreateNamespaceDialog,
  useKnowledgeNamespaces,
  useCreateKnowledgeNamespace,
  useDeleteKnowledgeNamespace,
} from '@mastra/playground-ui';

import { Link } from 'react-router';
import { Database } from 'lucide-react';

export default function Knowledge() {
  const { data, isLoading } = useKnowledgeNamespaces();
  const createNamespace = useCreateKnowledgeNamespace();
  const deleteNamespace = useDeleteKnowledgeNamespace();

  const namespaces = data?.namespaces ?? [];
  const isKnowledgeConfigured = data?.isKnowledgeConfigured ?? false;

  const handleCreateNamespace = (params: {
    namespace: string;
    description?: string;
    enableBM25?: boolean;
    vectorConfig?: { vectorStoreName?: string; indexName?: string };
  }) => {
    createNamespace.mutate(params);
  };

  const handleDeleteNamespace = (namespace: string) => {
    deleteNamespace.mutate(namespace);
  };

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <Database className="h-4 w-4" />
          </Icon>
          Knowledge
        </HeaderTitle>

        <HeaderAction>
          {isKnowledgeConfigured && (
            <CreateNamespaceDialog onSubmit={handleCreateNamespace} isLoading={createNamespace.isPending} />
          )}
          <Button as={Link} to="https://mastra.ai/en/docs/rag/overview" target="_blank">
            <Icon>
              <DocsIcon />
            </Icon>
            Documentation
          </Button>
        </HeaderAction>
      </Header>

      <div className="grid overflow-y-auto h-full">
        <div className="max-w-[100rem] px-[3rem] mx-auto grid content-start h-full w-full">
          <PageHeader
            title="Knowledge"
            description="Manage knowledge namespaces and artifacts for your agents"
            icon={<Database />}
          />

          <KnowledgeTable
            namespaces={namespaces}
            isLoading={isLoading}
            isKnowledgeConfigured={isKnowledgeConfigured}
            onDelete={handleDeleteNamespace}
          />
        </div>
      </div>
    </MainContentLayout>
  );
}
