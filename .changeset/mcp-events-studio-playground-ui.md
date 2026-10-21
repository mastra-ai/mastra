---
'@mastra/playground-ui': minor
---

`NotificationActivity` accepts two optional props: `extraBadges`, rendered after the priority, status and pending badges, and `messageLabel`, shown above the message once it's opened. MCP event notifications in agent threads use them to read `<server> · <event>`, to label the body as untrusted MCP server data, and to add a "gap" badge to an occurrence that followed a gap.

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
