---
'@mastra/playground-ui': minor
---

`EmptyState` is now the design system's only status block. A new `tone` prop colors its icon, and `tone="error"` defaults to the red circle-x icon `ErrorState` used to render.

**Breaking**

- `ErrorState` is removed. Use `EmptyState` with `tone="error"`:

  ```tsx
  // Before
  import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
  <ErrorState title="Failed to load tools" message={error.message} action={retryButton} />;

  // After
  import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
  <EmptyState tone="error" titleSlot="Failed to load tools" descriptionSlot={error.message} actionSlot={retryButton} />;
  ```

- `PermissionDenied` and `SessionExpired` hold Studio's permission copy and SSO login flow, so they moved out of the design system into the auth domain. Only the import path changes:

  ```tsx
  // Before
  import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
  import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';

  // After
  import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
  import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
  ```

`EmptyState` icons without their own color now render muted by default.
