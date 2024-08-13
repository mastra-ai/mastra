import { getIntegrations } from './get-integration';

export default async function Records() {
  const integrations = await getIntegrations();

  return <h1 className="text-light-text">Records</h1>;
}
