import { Metadata } from 'next';

import { Workflow } from './workflow';

export const metadata: Metadata = {
  title: 'Workflows',
  description: 'Workflows ...',
};

export default async function WorkflowPage(props: { params: Promise<{ blueprintId: string }> }) {
  const params = await props.params;
  return <Workflow blueprintId={params.blueprintId} />;
}
