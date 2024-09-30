# Mastra's Framework class

In building your app, you will need to call client APIs, sync data, and so on.

The [Mastra framework class](https://github.com/mastra-inc/future/blob/main/packages/core/src/framework.ts) is the main entry point for interacting with events and data from Mastra. It provides a set of methods for interacting with the framework, such as events, apis, and workflows.

There are some APIs on this class that are not intended to be used directly by users of Mastra. These are prefixed with an underscore (for integration authors) or double underscore (for framework use only).

The APIs

## Initializing

`Framework.init(config)`

This takes your config file and returns an instantiated instance of Mastra.

Convention is to assign this to a variable called `mastra`, for example:

```ts
import { Framework } from '@mastra/core';

import { config } from '../mastra.config';

const mastra = Framework.init(config);
```

## Integrations

`mastra.getIntegrations()`

Should be called on the instance of Mastra. This will return all integrations that are currently loaded.

`mastra.getIntegration(id)`

This will return a single integration by id.

## Getting and Triggering Events

`mastra.getEvents()`

This returns a list of all events.

`mastra.getSystemEvents()`

This returns all the system events that have been defined in `mastra.config.ts`.

`mastra.triggerEvent(eventType: string, data: any)`

`mastra.triggerSystemEvent(eventType: string, data: any)`

This triggers a specific event.

`mastra.subscribeEvent(id: String, interval: number, timeout: number)`

This subscribes to a specific event,

## Apis

``callApi`

This calls a specific third-party API.

## Workflows

`runBlueprint`

This runs a specific workflow blueprint stored in the `mastra-blueprints` folder.
