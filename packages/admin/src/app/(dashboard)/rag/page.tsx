import { Header } from '@/app/components/header';

export default function RagPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="sticky top-0">
        <Header linkText="New RAG Sync" href="/rag/create" breadcrumbLabel="RAG" />
      </div>
    </div>
  );
}
