# @firebase/logger

This package serves as the base of all logging in the JS SDK. Any logging that
is intended to be visible to Firebase end developers should go through this
module.

## Basic Usage

Firebase components should import the `Logger` class and instantiate a new
instance by passing a component name (e.g. `@firebase/<COMPONENT>`) to the
constructor.

_e.g._

```typescript
import { Logger } from '@firebase/logger';

const logClient = new Logger(`@firebase/<COMPONENT>`);
```

Each `Logger` instance supports 5 log functions each to be used in a specific
instance:

- `debug`: Internal logs; use this to allow developers to send us their debug
  logs for us to be able to diagnose an issue.
- `log`: Use to inform your user about things they may need to know.
- `info`: Use if you have to inform the user about something that they need to
  take a concrete action on. Once they take that action, the log should go away.
- `warn`: Use when a product feature may stop functioning correctly; unexpected
  scenario.
- `error`: Only use when user App would stop functioning correctly - super rare!

## Log Format

Each log will be formatted in the following manner:

```typescript
`[${new Date()}]  ${COMPONENT_NAME}: ${...args}`
```

