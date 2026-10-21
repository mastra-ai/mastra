---
'@mastra/playground-ui': minor
---

Added optional `extraBadges` and `messageLabel` props to `NotificationActivity`. `extraBadges` renders after the priority, status and pending badges, and `messageLabel` is shown above the message once it's opened. MCP event notifications in agent threads use them to label the body as untrusted MCP server data and to add a "gap" badge to an occurrence that followed a gap.

```tsx
import { NotificationActivity } from '@mastra/playground-ui/components/ai/activity';
import { Badge } from '@mastra/playground-ui/components/Badge';

<NotificationActivity
  label="tickets · ticket.created"
  message={summary}
  extraBadges={<Badge variant="amber">gap</Badge>}
  messageLabel="Untrusted MCP server data"
/>;
```
