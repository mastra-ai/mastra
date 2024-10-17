import { getPineconeIndices } from '@mastra/core';

import { Header } from '@/components/header';

import RagTable from '@/domains/rag/components/rag-table';
import { ragTableColumns } from '@/domains/rag/components/rag-table-columns';

export const dynamic = 'force-dynamic';

export default async function RagPage() {
  const indexes = await getPineconeIndices();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="sticky top-0">
        <Header linkText="New RAG Sync" href="/rag/create" breadcrumbLabel="RAG" />
      </div>
      <RagTable columns={ragTableColumns} data={indexes || []} />
    </div>
  );
}
