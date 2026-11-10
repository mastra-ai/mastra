import { buildThreadLeaseAgent } from './thread-lease-agent';

const [dbUrl, agentId, inngestPort, socketPath, logPath, threadId, resourceId, prompt] = process.argv.slice(2);

if (!dbUrl || !agentId || !inngestPort || !socketPath || !logPath || !threadId || !resourceId || !prompt) {
  throw new Error('Expected <dbUrl> <agentId> <inngestPort> <socketPath> <logPath> <threadId> <resourceId> <prompt>');
}

const { durableAgent } = buildThreadLeaseAgent({
  dbUrl,
  agentId,
  inngestPort: Number(inngestPort),
  socketPath,
  logPath,
});
const result = await durableAgent.stream([{ role: 'user', content: prompt }], {
  memory: { thread: threadId, resource: resourceId },
});
console.log('THREAD_LEASE_CALLER_STREAMING');
for await (const _ of result.output.fullStream) {
  // Keep the caller alive (and renewing its lease) until the test kills it.
}
