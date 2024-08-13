import { getConfig } from '../../lib/get-configuration';

export default async function Records() {
  const integrations = await getConfig().then(res => res.integrations);

  return <h1 className="text-light-text p-4">Records</h1>;
}
