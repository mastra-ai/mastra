import { Header } from '@/app/components/header';
import { fetchPineconeIndexes } from '@/domains/rag/actions';
import RagTable from '@/domains/rag/components/rag-table';
import { ragTableColumns } from '@/domains/rag/components/rag-table-columns';

export default async function RagPage() {
  const indexes = await fetchPineconeIndexes();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="sticky top-0">
        <Header linkText="New RAG Sync" href="/rag/create" breadcrumbLabel="RAG" />
      </div>
      <RagTable columns={ragTableColumns} data={indexes || []} />
    </div>
  );
}
