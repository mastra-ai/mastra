import { SlackConnector } from '@/components/slack-oauth';

import { XConnector } from '../components/twitter-oauth';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 w-full max-w-5xl font-mono text-sm space-y-4">
        <h1 className="text-4xl">Hello</h1>
        <XConnector />
        <SlackConnector />
      </div>
    </main>
  );
}
