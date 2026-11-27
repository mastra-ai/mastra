---
'@mastra/playground-ui': minor
---

Added Factory's card source presentation to `@mastra/playground-ui/domains/factory`: `CARD_SOURCES` (label, link label and mark for every place a card can come from), `cardSourceOf`, `CardSourceIcon`, `CardSourceRow`, `SourceStateBadge`, `outboundArrowClass`, and the GitLab, Jira and incident.io brand marks.

```tsx
import { CardSourceIcon, CardSourceRow, cardSourceOf } from '@mastra/playground-ui/domains/factory';

const externalSource = {
  integrationId: 'github',
  type: 'pull-request',
  url: 'https://github.com/acme/app/pull/117',
};
const source = cardSourceOf(externalSource); // e.g. 'github-pr'

<>
  <CardSourceIcon source={source} />
  <CardSourceRow reference="#117" url={externalSource.url} state="open" />
</>
```
