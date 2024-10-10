import { ReactNode } from 'react';

import { AgentFormProvider } from '@/domains/agents/context/agent-form-context';

export default function Layout({ children }: { children: ReactNode }) {
  return <AgentFormProvider>{children}</AgentFormProvider>;
}
