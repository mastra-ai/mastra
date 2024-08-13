import { Metadata } from 'next';

import { getConfig } from '@/lib/get-configuration';

import { Workflows } from '@/domains/workflows/components/workflows';

export const metadata: Metadata = {
  title: 'Workflows',
  description: 'Workflows ...',
};

export default async function WorkflowsListPage() {
  const workflows = await getConfig().then(res => res.workflows);
  return <Workflows workflows={workflows} />;
}
