// @ts-nocheck
// Should transform - imports from @mastra/core
import { MastraDBMessage } from '@mastra/core';
import type { MastraDBMessage as V2Message } from '@mastra/core';

// Should transform - type usage
function processMessage(message: MastraDBMessage) {
  return message;
}

const messages: MastraDBMessage[] = [];
const aliasedMessage: MastraDBMessage = {} as any;

// Should NOT transform - different package
import { MastraMessageV2 as OtherV2 } from 'other-package';
const otherMsg: OtherV2 = {} as any;