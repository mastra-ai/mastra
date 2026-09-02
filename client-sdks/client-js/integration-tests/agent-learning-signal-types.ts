import type { TraceSignalName } from '../src/agent-learning';

const issuesSignal: TraceSignalName = 'issues';

// @ts-expect-error behavior is no longer a built-in trace signal
const behaviorSignal: TraceSignalName = 'behavior';

void issuesSignal;
void behaviorSignal;
