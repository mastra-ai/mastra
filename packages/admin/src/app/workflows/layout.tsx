import { ReactNode } from 'react';

import WorkflowsLayout from '@/domains/workflows/layouts/workflows-layout';

export default function WorkflowsParentLayout({ children }: { children: ReactNode }) {
  return <WorkflowsLayout>{children}</WorkflowsLayout>;
}
