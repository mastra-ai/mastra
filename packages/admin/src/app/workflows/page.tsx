import { Metadata } from 'next';

import { Workflows } from './workflows';

export const metadata: Metadata = {
  title: 'Workflows',
  description: 'Workflows ...',
};

export default function WorkflowsListPage() {
  return <Workflows />;
}
