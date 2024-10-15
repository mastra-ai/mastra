import { Header } from '@/app/components/header';
import RagTable from '@/domains/rag/components/rag-table';
import { ragTableColumns } from '@/domains/rag/components/rag-table-columns';

export default function RagPage() {
  // TODO: retrieve indexes
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="sticky top-0">
        <Header linkText="New RAG Sync" href="/rag/create" breadcrumbLabel="RAG" />
      </div>
      <RagTable columns={ragTableColumns} data={[]} />
    </div>
  );
}
