import { SlackConnector } from '@/components/slack-oauth';

import { XConnector } from '../components/twitter-oauth';

export default function Home() {
  return (
    <main className="p-24">
      <div className="font-mono text-sm space-y-6">
        <h1 className="text-4xl">Hello</h1>
        <XConnector />
        <SlackConnector />
      </div>
    </main>
  );
}
