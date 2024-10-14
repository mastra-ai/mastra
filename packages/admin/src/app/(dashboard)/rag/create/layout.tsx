import { ReactNode } from 'react';

import { VectorFormProvider } from '@/domains/rag/context/vector-form-context';

export default function Layout({ children }: { children: ReactNode }) {
  return <VectorFormProvider>{children}</VectorFormProvider>;
}
