---
'@mastra/connect': minor
---

Added a SendGrid toolset with 53 tools. Agents can send email, and manage marketing contacts, lists, segments, custom fields, dynamic templates and template versions, sender identities, and global and group suppressions, and read and clear blocks, bounces, invalid emails, and spam reports.

```ts
import { Agent } from '@mastra/core/agent';
import { tools } from '@mastra/connect';

const sendgridAgent = new Agent({
  id: 'sendgrid-agent',
  name: 'SendGrid agent',
  instructions: 'Use the connected SendGrid tools to manage contacts, lists, and templates.',
  model: 'openai/gpt-5.6',
  tools: tools({ providers: ['sendgrid'] }),
});
```
