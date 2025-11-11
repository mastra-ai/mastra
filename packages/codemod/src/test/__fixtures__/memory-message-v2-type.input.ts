// @ts-nocheck
// Should transform - imports from @mastra/core
import { MastraMessageV2 } from '@mastra/core';
import type { MastraMessageV2 as V2Message } from '@mastra/core';

// Should transform - type usage
function processMessage(message: MastraMessageV2) {
  return message;
}

const messages: MastraMessageV2[] = [];
const aliasedMessage: V2Message = {} as any;

// Should NOT transform - different package
import { MastraMessageV2 as OtherV2 } from 'other-package';
const otherMsg: OtherV2 = {} as any;