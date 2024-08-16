import { Metadata } from 'next';

import { Workflow } from './workflow';

export const metadata: Metadata = {
  title: 'Workflows',
  description: 'Workflows ...',
};

export default function WorkflowPage({ params }: { params: { blueprintId: string } }) {
  return <Workflow blueprintId={params.blueprintId} />;
}
