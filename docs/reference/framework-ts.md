# Kepler's Framework class

In building your app, you will need to call client APIs, sync data, and so on. 

The [Kepler framework class](https://github.com/kepler-inc/future/blob/main/packages/core/src/framework.ts) is the main entry point for interacting with events and data from Kepler. It provides a set of methods for interacting with the framework, such as events, apis, and workflows.

There are some APIs on this class that are not intended to be used directly by users of Kepler. These are prefixed with an underscore (for integration authors) or double underscore (for framework use only).

The APIs

## Initializing

`Framework.init(config)`

This takes your config file and returns an instantiated instance of Kepler. Convention is to assign this to a variable called `kepler`, for example:

```ts
import { Framework } from '@kpl/core';

import { config } from '../kepler.config';

const kepler = Framework.init(config);
```

## Integrations

`kepler.getIntegrations()`

Should be called on the instance of Kepler. This will return all integrations that are currently loaded.

`kepler.getIntegration(id)`

This will return a single integration by id.

## Getting and Triggering Events

```kepler.getEvents()```

This returns a list of all events.

```kepler.getSystemEvents()```

This returns all the system events that have been defined in `kepler.config.ts`.

```kepler.triggerEvent(eventType: string, data: any)```

```kepler.triggerSystemEvent(eventType: string, data: any)```

This triggers a specific event.

```kepler.subscribeEvent(id: String, interval: number, timeout: number)```

This subscribes to a specific event, 

## Apis

```callApi``


## Workflows

```runBlueprint```
