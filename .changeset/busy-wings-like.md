---
'@mastra/server': patch
---

Fixed configured `mapUserToResourceId` callbacks silently disabling isolation when they return an invalid resource ID. Requests now fail before reaching a route instead of falling back to a client-provided resource ID. Providers without a mapper and custom middleware retain their existing behavior. Update `@mastra/core` as well when using `CompositeAuth` to receive the selected-provider validation fix.
