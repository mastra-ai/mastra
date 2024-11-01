import { getPineconeIndices } from '@mastra/core';
import { Metadata } from 'next';

import { Header } from '@/components/header';

import { framework } from '@/lib/framework-utils';

import RagTable from '@/domains/rag/components/rag-table';
import { ragTableColumns } from '@/domains/rag/components/rag-table-columns';
import { RagMetadata, VectorIndexWithMetadata } from '@/domains/rag/types';

export const metadata: Metadata = {
  title: 'RAG Sync',
  description: 'RAG Sync ...',
};

export const dynamic = 'force-dynamic';

export default async function RagPage() {
  const indicies = await getPineconeIndices();

  const metadataPromises = indicies.map(index =>
    framework?.vectorLayer.getPineconeIndexWithMetadata({ name: index.name }),
  );

  const metadataResults = await Promise.all(metadataPromises);

  const ragTableData = indicies
    .map((index, i) => {
      return {
        ...index,
        metadata: metadataResults[i] ? metadataResults[i]?.[0] : ({} as RagMetadata),
      };
    })
    .filter(data => data.metadata !== undefined) as VectorIndexWithMetadata[];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="sticky top-0">
        <Header linkText="New RAG Sync" href="/rag/create" breadcrumbLabel="RAG" />
      </div>
      <RagTable columns={ragTableColumns} data={ragTableData || []} />
    </div>
  );
}
