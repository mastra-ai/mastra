import { ClientLayout } from './client-layout';

export default async function Integration({ params }: { params: { integration: string } }) {
  return <ClientLayout integration={params.integration} fields={[]} data={[]} />;
}
