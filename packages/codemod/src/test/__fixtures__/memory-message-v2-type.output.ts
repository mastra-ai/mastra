// @ts-nocheck
// Should transform - imports from @mastra/core
import { MastraDBMessage } from '@mastra/core';
import type { MastraDBMessage as V2Message } from '@mastra/core';
import type { MastraDBMessage as AgentMessage } from '@mastra/core/agent';
import type { MastraDBMessage as MemoryMessage } from '@mastra/core/memory';

// Should transform - type usage
function processMessage(message: MastraDBMessage) {
  return message;
}

const messages: MastraDBMessage[] = [];
const aliasedMessage: V2Message = {} as any;
const agentMessage: AgentMessage = {} as any;
const memoryMessage: MemoryMessage = {} as any;

// Should NOT transform - different package
import { MastraMessageV2 as OtherV2 } from 'other-package';
const otherMsg: OtherV2 = {} as any;
