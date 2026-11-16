import { Scheduler } from '@mastra/core/workflows';

import { LibSQLStore } from '../../../storage';
import { runPeer } from '../peer-runtime';

export interface SchedulerPublicationArgs {
  boundary: 'claimed' | 'published';
  fireAt: number;
}

runPeer<SchedulerPublicationArgs>(async peer => {
  const storage = new LibSQLStore({ id: 'scheduler-publisher', url: peer.dbUrl });
  await storage.init();
  const schedules = (await storage.getStore('schedules'))!;
  const pubsub = peer.pubsub();
  const park = async () => {
    await peer.signal('boundary');
    await peer.waitFor('release');
  };

  if (peer.args.boundary === 'claimed') {
    const claim = schedules.updateScheduleNextFire.bind(schedules);
    schedules.updateScheduleNextFire = async (...args) => {
      const claimed = await claim(...args);
      // The real file-backed commit has completed, but Scheduler has not published.
      if (claimed) await park();
      return claimed;
    };
  } else {
    const publish = pubsub.publish.bind(pubsub);
    pubsub.publish = async (...args) => {
      const result = await publish(...args);
      // The real shared transport accepted the event, but Scheduler has no response yet.
      await park();
      return result;
    };
  }

  Date.now = () => peer.args.fireAt + 1_000;
  await new Scheduler({ schedulesStore: schedules, pubsub }).tick();
  await storage.close();
});
