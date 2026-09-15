import { createInterface } from 'node:readline';

import { createSignalsPubSub } from '../../utils/signals-pubsub.js';

const [resourceId, threadId] = process.argv.slice(2);
if (!resourceId || !threadId) throw new Error('Expected resourceId and threadId arguments');

const pubsub = createSignalsPubSub(resourceId);
const topic = `agent.thread-stream.${encodeURIComponent(`${resourceId}\0${threadId}`)}`;

await pubsub.subscribe(topic, event => {
  if (event.type === 'run-registered' || event.type === 'run-completed') {
    process.stdout.write(`${JSON.stringify({ event: event.type, pid: process.pid })}\n`);
  }
});
process.stdout.write(`${JSON.stringify({ event: 'ready', pid: process.pid })}\n`);

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of lines) {
  if (line === 'close') break;
}

await pubsub.close();
