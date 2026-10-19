---
'@mastra/playground-ui': minor
---

Added `errorToast` and `ErrorNotice` for consistent error messages. Both take one typed message: what happened (`title`), why, and the next step (`fix`), plus optional `reassurance` and a `wayOut` link to docs or support, labeled `Docs` or `Support`. Toasts show the title, cause, and next step. `ErrorNotice` renders a destructive `Notice` with every part and the link.

```tsx
import { errorToast, ErrorNotice, type ErrorMessage } from '@mastra/playground-ui/utils/error-message';

const message: ErrorMessage = {
  title: 'Couldn’t delete orders-db',
  why: 'Two environments still use it.',
  reassurance: 'Nothing was deleted.',
  fix: 'Detach it from both environments, then delete it.',
  wayOut: { kind: 'docs', href: 'https://mastra.ai/docs' },
};

errorToast(message);

<ErrorNotice message={message} />;
```
