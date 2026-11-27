---
'@mastra/playground-ui': minor
---

Added Factory's model settings to `@mastra/playground-ui/domains/factory`: model packs, per-phase model routing, provider rows with OAuth sign-in, and the Preferences section (theme, completion sound). Apps other than Factory, such as Managed Agents, can now render the same settings.

The OAuth dialog takes its complete and poll actions as props, so each app wires its own API:

```tsx
import { PreferencesSettings, ProviderOAuthDialog } from '@mastra/playground-ui/domains/factory';

<PreferencesSettings />

<ProviderOAuthDialog
  provider="anthropic"
  session={session}
  actions={{ complete: completeOAuth, poll: pollOAuth }}
  onClose={close}
  onComplete={close}
/>
```

The Preferences section renders the default completion sound on the server and switches to the saved one once the page hydrates, so server-rendered apps such as Next.js no longer hit a hydration mismatch. `useDoneSound()` reads the saved sound and updates when it changes.
