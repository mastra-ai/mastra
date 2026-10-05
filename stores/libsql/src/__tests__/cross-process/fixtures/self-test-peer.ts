/** Peer fixture for peer-helper.test.ts. `args.mode` selects the scenario. */
import { createDurableAgent, globalRunRegistry } from '@mastra/core/agent/durable';
import type { Event } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';

import { LibSQLStore } from '../../../storage';
import { runPeer } from '../peer-runtime';
import { createStepAgent, gate } from '../step-agent';

export type SelfTestArgs =
  | { mode: 'publish'; topic: string; payload: string }
  | { mode: 'db-write'; threadId: string }
  | { mode: 'silent' }
  | { mode: 'heard'; topic: string }
  | { mode: 'registry'; runId: string };

runPeer<SelfTestArgs>(async peer => {
  const { args } = peer;
  switch (args.mode) {
    case 'publish': {
      await peer.pubsub().publish(args.topic, { type: 'ping', runId: 'self-test', data: { payload: args.payload } });
      return { pid: process.pid };
    }

    case 'db-write': {
      const store = new LibSQLStore({ id: 'self-test-peer', url: peer.dbUrl });
      await store.init();
      const memory = (await store.getStore('memory'))!;
      await memory.saveThread({
        thread: {
          id: args.threadId,
          resourceId: `written-by-${process.pid}`,
          title: 'xproc',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      await store.close();
      return { pid: process.pid };
    }

    case 'silent': {
      // Never signals; only finishes when the test says so.
      await peer.waitFor('finish');
      return { pid: process.pid };
    }

    case 'heard': {
      const heard = new Promise<Event>(resolve => {
        void peer.pubsub().subscribe(args.topic, event => resolve(event));
      });
      // subscribe() resolves once the broker acknowledged the membership, so a
      // publish after this signal is routed to this process.
      await peer.pubsub().subscribe(`${args.topic}.ready`, () => {});
      await peer.signal('subscribed');
      const event = await heard;
      await peer.signal('heard', event.data);
      return { pid: process.pid };
    }

    case 'registry': {
      const parked = gate();
      const release = gate();
      const { agent } = createStepAgent({
        id: 'self-test-registry',
        steps: 1,
        blockAt: 1,
        release: release.promise,
        onToolEvent: event => {
          if (event.event === 'reached') parked.resolve();
        },
      });
      const durable = createDurableAgent({ agent });
      const storage = new LibSQLStore({ id: 'self-test-registry', url: peer.dbUrl });
      const mastra = new Mastra({ agents: { durable }, storage, pubsub: peer.pubsub(), logger: false });
      if ((mastra.getAgent('durable') as unknown) !== durable)
        throw new Error('Mastra replaced the registered durable agent');

      const result = await durable.stream('Go', { runId: args.runId });
      await parked.promise;
      await peer.signal('parked', { pid: process.pid, present: globalRunRegistry.get(args.runId) !== undefined });
      await peer.waitFor('release');
      release.resolve();
      const text = await result.output.text;
      await storage.close();
      return { text };
    }
  }
});
