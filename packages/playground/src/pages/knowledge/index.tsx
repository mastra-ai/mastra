import {
  MainContentLayout,
  Header,
  HeaderTitle,
  MainContentContent,
  Icon,
  HeaderAction,
  DocsIcon,
  Button,
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
  const isEmpty = !isLoading && namespaces.length === 0;

  const handleCreateNamespace = (params: { namespace: string; description?: string; enableBM25?: boolean }) => {
    createNamespace.mutate(params);
  };

  const handleDeleteNamespace = (namespace: string) => {
    if (confirm(`Are you sure you want to delete the namespace "${namespace}" and all its artifacts?`)) {
      deleteNamespace.mutate(namespace);
    }
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
          <Button as={Link} to="https://mastra.ai/en/docs" target="_blank">
            <Icon>
              <DocsIcon />
            </Icon>
            Documentation
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent isCentered={isEmpty || !isKnowledgeConfigured}>
        <KnowledgeTable
          namespaces={namespaces}
          isLoading={isLoading}
          isKnowledgeConfigured={isKnowledgeConfigured}
          onDelete={handleDeleteNamespace}
        />
      </MainContentContent>
    </MainContentLayout>
  );
}
