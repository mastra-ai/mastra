import { SlackConnector } from '@/components/slack-oauth';

import { framework } from '@/lib/framework-utils';

import { XConnector } from '../components/twitter-oauth';

export default async function Home() {
  const xConnection = await framework?.dataLayer.getConnectionByReferenceId({ name: 'X', referenceId: 'user-1' });
  const slackConnection = await framework?.dataLayer.getConnectionByReferenceId({
    name: 'Slack',
    referenceId: 'user-1',
  });
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 w-full max-w-5xl font-mono text-sm space-y-4">
        <h1 className="text-4xl">Hello</h1>
        <XConnector connection={xConnection} />
        <SlackConnector connection={slackConnection} />
      </div>
    </main>
  );
}
