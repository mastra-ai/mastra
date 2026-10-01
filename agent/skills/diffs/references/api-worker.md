# Worker API

This reference lists every export from `@pierre/diffs/worker`, every public
`WorkerPoolManager` member, and both worker script entries.

## Runtime exports

| Export                           | Kind     | Purpose                                               |
| -------------------------------- | -------- | ----------------------------------------------------- |
| `WorkerPoolManager`              | Class    | Runs file and diff highlighting across a worker pool. |
| `getOrCreateWorkerPoolSingleton` | Function | Gets or creates the module-wide worker pool.          |
| `terminateWorkerPoolSingleton`   | Function | Terminates and clears the module-wide worker pool.    |

## `WorkerPoolManager` members

| Member                                                         | Purpose                                           |
| -------------------------------------------------------------- | ------------------------------------------------- |
| `new WorkerPoolManager(options, renderOptions)`                | Creates a worker pool.                            |
| `initialize(languages?)`                                       | Starts workers and loads languages.               |
| `isInitialized()`                                              | Reports whether initialization finished.          |
| `isWorkingPool()`                                              | Reports whether workers can accept work.          |
| `setRenderOptions(options)`                                    | Updates theme and render settings in each worker. |
| `getFileRenderOptions()`                                       | Gets active file render options.                  |
| `getDiffRenderOptions()`                                       | Gets active diff render options.                  |
| `highlightFileAST(instance, file)`                             | Queues a highlighted file result for an instance. |
| `highlightDiffAST(instance, diff)`                             | Queues a highlighted diff result for an instance. |
| `primeFileHighlightCache(file)`                                | Preloads one highlighted file result.             |
| `primeDiffHighlightCache(diff)`                                | Preloads one highlighted diff result.             |
| `getFileResultCache(file)`                                     | Gets one cached file result.                      |
| `getDiffResultCache(diff)`                                     | Gets one cached diff result.                      |
| `getPlainFileAST(file, start, total, lines?)`                  | Gets a plain-text file result.                    |
| `getPlainDiffAST(diff, start, total, expansions?, threshold?)` | Gets a plain-text diff result.                    |
| `inspectCaches()`                                              | Gets both result caches.                          |
| `evictFileFromCache(cacheKey)`                                 | Removes one file cache entry.                     |
| `evictDiffFromCache(cacheKey)`                                 | Removes one diff cache entry.                     |
| `subscribeToThemeChanges(instance)`                            | Subscribes a render instance to theme changes.    |
| `unsubscribeToThemeChanges(instance)`                          | Removes a theme subscription.                     |
| `subscribeToStatChanges(callback)`                             | Subscribes to worker statistics.                  |
| `cleanUpTasks(instance)`                                       | Removes queued and active tasks for an instance.  |
| `getStats()`                                                   | Gets worker and cache statistics.                 |
| `terminate()`                                                  | Stops workers and clears pool resources.          |

## Configuration and state types

| Export                              | Purpose                                                           |
| ----------------------------------- | ----------------------------------------------------------------- |
| `SetupWorkerPoolProps`              | Combines pool and highlighter options for the singleton.          |
| `WorkerPoolOptions`                 | Defines the worker factory, pool size, and cache size.            |
| `WorkerInitializationRenderOptions` | Defines initial languages, theme, highlighter, and diff settings. |
| `WorkerRenderingOptions`            | Defines the complete worker render settings.                      |
| `WorkerStats`                       | Describes pool state, work counts, subscribers, and cache sizes.  |
| `WorkerRequestId`                   | Identifies one worker request.                                    |
| `ResolvedLanguage`                  | Holds a resolved language registration.                           |
| `FileRendererInstance`              | Defines callbacks for a file render consumer.                     |
| `DiffRendererInstance`              | Defines callbacks for a diff render consumer.                     |

## Request and response types

| Export                          | Purpose                                                 |
| ------------------------------- | ------------------------------------------------------- |
| `WorkerRequest`                 | Represents any request sent to a worker.                |
| `InitializeWorkerRequest`       | Starts a worker with themes, languages, and options.    |
| `SetRenderOptionsWorkerRequest` | Updates render options and themes.                      |
| `RenderFileRequest`             | Requests one file render.                               |
| `RenderDiffRequest`             | Requests one diff render.                               |
| `SubmitRequest`                 | Represents a file or diff request before ID assignment. |
| `WorkerResponse`                | Represents any worker response.                         |
| `InitializeSuccessResponse`     | Confirms worker initialization.                         |
| `RegisterThemeSuccessResponse`  | Confirms a render-option and theme update.              |
| `RenderSuccessResponse`         | Represents a successful file or diff render.            |
| `RenderFileSuccessResponse`     | Returns one file render result.                         |
| `RenderDiffSuccessResponse`     | Returns one diff render result.                         |
| `RenderErrorResponse`           | Returns a serialized worker error.                      |

## Task types

| Export                       | Purpose                                           |
| ---------------------------- | ------------------------------------------------- |
| `AllWorkerTasks`             | Represents any manager task.                      |
| `InitializeWorkerTask`       | Tracks one initialization request.                |
| `SetRenderOptionsWorkerTask` | Tracks one render-option update.                  |
| `RenderFileTask`             | Tracks one file render request and its consumers. |
| `RenderDiffTask`             | Tracks one diff render request and its consumers. |
| `RenderTaskCallbacks`        | Resolves or rejects one render task consumer.     |

## Worker script entries

| Import                                    | Purpose                                                    |
| ----------------------------------------- | ---------------------------------------------------------- |
| `@pierre/diffs/worker/worker.js`          | Supplies the module worker that uses package dependencies. |
| `@pierre/diffs/worker/worker-portable.js` | Supplies a bundled module worker.                          |
