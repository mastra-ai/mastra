import { Header } from '@/components/header';

export const AgentHeader = () => {
  return (
    <div className="sticky top-0">
      <Header linkText="New agent" href="/agents/create" breadcrumbLabel="Agents" />
    </div>
  );
};
