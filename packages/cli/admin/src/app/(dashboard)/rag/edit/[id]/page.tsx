import { getPineconeIndices } from '@mastra/core';
import { Metadata } from 'next';

import Icon from '@/components/icon';

import { framework } from '@/lib/framework-utils';

import { VectorProviderForm } from '@/domains/rag/components/vector-provider-form';
import { RagMetadata, VectorIndexWithMetadata } from '@/domains/rag/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Edit RAG Sync',
  description: 'Edit RAG Sync ...',
};

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const indicies = await getPineconeIndices();
  const metadataPromises = indicies.map(index =>
    framework?.vectorLayer.getPineconeIndexWithMetadata({ name: index.name }),
  );

  const metadataResults = await Promise.all(metadataPromises);

  const ragTableData = indicies
    .map((index, i) => {
      return {
        ...index,
        metadata: metadataResults[i] ? metadataResults[i][0] : ({} as RagMetadata),
      };
    })
    .filter(data => data.metadata !== undefined) as VectorIndexWithMetadata[];

  const rag = ragTableData.find(index => index.id === params.id);

  const entity = {
    integration: rag?.metadata.integration!,
    data: [
      {
        name: rag?.metadata.name!,
        fields: rag?.metadata.fields!,
        syncEvent: rag?.metadata.syncEvent!,
        syncParams: rag?.metadata.syncParams!,
      },
    ],
  };

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="flex h-[var(--top-bar-height)] bg-mastra-bg-1 sticky top-0 w-full content-center items-center justify-between border-b-[0.1px] border-mastra-border-1 px-[1.31rem]">
        <div className="h-fit items-center  gap-1.5 flex">
          <span className=" bg-mastra-bg-3 rounded h-7 w-7 grid place-items-center">
            <Icon name="sync" className="w-3 h-3" />
          </span>
          <h1 className="text-base">Edit RAG Sync</h1>
        </div>
      </div>
      <section className="flex-1 overflow-scroll space-y-4 p-4">
        <VectorProviderForm entity={entity} name={rag?.name} source={'edit'} />
      </section>
    </div>
  );
}
