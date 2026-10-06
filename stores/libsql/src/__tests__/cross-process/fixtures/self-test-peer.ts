/** Peer fixture for peer-helper.test.ts. `args.mode` selects the scenario. */
import { createDurableAgent, globalRunRegistry } from '@mastra/core/agent/durable';
import type { Event } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';

import { LibSQLStore } from '../../../storage';
import { runPeer } from '../peer-runtime';
import { bootWorkers } from '../process-workers';
import { createStepAgent, gate } from '../step-agent';
import { createMarkerWorkflow } from './marker-workflow';

export type SelfTestArgs =
  | { mode: 'publish'; topic: string; payload: string }
  | { mode: 'db-write'; threadId: string }
  | { mode: 'silent' }
  | { mode: 'instant' }
  | { mode: 'heard'; topic: string }
  | { mode: 'registry'; runId: string }
  | { mode: 'workflow-producer'; workflowId: string; logPath: string }
  | { mode: 'flush-fails' };

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

    case 'instant': {
      // Returns as soon as the runtime lets it: the peer is gone again almost
      // as soon as its startup ping lands, which is the case the self-check has
      // to survive without sampling the broker's client count after the fact.
      return { pid: process.pid };
    }

    case 'heard': {
      const heard = gate<Event>();
      // subscribe() resolves once the broker acknowledged the membership, so
      // everything published after this point is routed to this process.
      await peer.pubsub().subscribe(args.topic, event => heard.resolve(event));
      await peer.signal('subscribed');
      const event = await heard.promise;
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
      // This process owns (and has finished) the run, so unlike the T79 peer it
      // can shut its instance down before closing the store it owns.
      await mastra.shutdown();
      await storage.close();
      return { text };
    }

    case 'workflow-producer': {
      // Producer side: this process must never boot its workers, so the
      // workflow event it publishes is only executed by the other process.
      const storage = new LibSQLStore({ id: 'self-test-producer', url: peer.dbUrl });
      await storage.init();
      const workflow = createMarkerWorkflow({ id: args.workflowId, logPath: args.logPath });
      const mastra = new Mastra({
        workflows: { [args.workflowId]: workflow },
        storage,
        pubsub: peer.pubsub(),
        logger: false,
        workers: peer.workers ? undefined : false,
      });
      await bootWorkers(mastra, peer.workers);
      const run = await workflow.createRun();
      await run.startAsync({ inputData: {} });
      await peer.signal('started', { runId: run.runId, pid: process.pid });
      await peer.waitFor('finish');
      // Drain before returning: if this process did execute the event after
      // all, its marker must be written before the test reads the log.
      await mastra.shutdown();
      await storage.close();
      return { runId: run.runId, pid: process.pid };
    }

    case 'flush-fails': {
      // Makes the mandatory flush-before-exit fail, so the test can prove a
      // lost-frame risk becomes this peer's error outcome and not a silent
      // success. The instance is patched; the process's own cleanups are
      // unaffected because this peer exits through runPeer.
      peer.pubsub().flush = async () => {
        throw new Error('injected flush failure');
      };
      return { pid: process.pid };
    }
  }
});
