---
'@mastra/playground-ui': patch
---

Connect providers that use OAuth client credentials (`OAUTH2_CC`) or no authentication (`NONE`) without leaving Studio. Client-credential providers ask for a client ID and secret in the connect dialog; providers with no authentication connect immediately instead of opening an OAuth popup.

Providers whose catalog lists only connection settings (for example a subdomain) now also ask for their API key, username and password, or client ID and secret. Previously the dialog showed only the settings, and the connection failed.

The headless connect helpers in `@mastra/playground-ui/domains/connect` now return a fully resolved `HeadlessAuthField` and support conditional fields (`visibleWhen`), so other apps can import them instead of keeping their own copy.

```ts
import {
  headlessAuthFieldKey,
  headlessAuthFields,
  isHeadlessAuthFieldVisible,
  splitHeadlessAuthValues,
  startHeadlessAuth,
} from '@mastra/playground-ui/domains/connect';

// Every field comes back fully resolved: label, target, required, and so on are always set.
const fields = headlessAuthFields(provider);

// Render only the fields whose `visibleWhen` condition matches the current values.
const visible = fields.filter(field => isHeadlessAuthFieldVisible(fields, field, values));
const missingRequired = visible.some(field => field.required && !values[headlessAuthFieldKey(field)]);

// On submit, values for hidden fields are dropped.
const { credentials, params } = splitHeadlessAuthValues(fields, values);
await startHeadlessAuth({ sessionToken, integrationId: provider.id, authType: provider.authType, credentials, params })
  .result;
```
