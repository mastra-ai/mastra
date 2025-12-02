# @clack/prompts

## 1.0.0-alpha.6

### Minor Changes

- 8409f2c: feat: add styleFrame option for spinner

### Patch Changes

- aea4573: Clamp scrolling windows to 5 rows.
- b103ad3: Allow disabled options in multi-select and select prompts.
- Updated dependencies [b103ad3]
  - @clack/core@1.0.0-alpha.6

## 1.0.0-alpha.5

### Minor Changes

- 55645c2: Support wrapping autocomplete and select prompts.

### Patch Changes

- 9999adf: fix note component overflow bug
- 2839c66: fix(note): hard wrap text to column limit
- 71b5029: Add missing nullish checks around values.
- d25f6d0: fix(note, box): handle CJK correctly
- 0b852e1: Handle `stop` calls on spinners which have not yet been started.
- 09e596c: refactor(progress): remove unnecessary return statement in start function
- 2310b43: Allow custom writables as output stream.
- Updated dependencies [71b5029]
- Updated dependencies [55645c2]
- Updated dependencies [2310b43]
  - @clack/core@1.0.0-alpha.5

## 1.0.0-alpha.4

### Patch Changes

- 7b009df: Fix spinner clearing too many lines upwards when non-wrapping.
- ae84dd0: Update key binding text to show tab/space when navigating, and tab otherwise.
- Updated dependencies [d98e033]
  - @clack/core@1.0.0-alpha.4

## 1.0.0-alpha.3

### Minor Changes

- 76fd17f: Added new `box` prompt for rendering boxed text, similar a note.
- 1604f97: Add `clearOnError` option to password prompt to automatically clear input when validation fails

### Patch Changes

- 1a45f93: Switched from wrap-ansi to fast-wrap-ansi
- 4c89dd7: chore: use more accurate type to replace any in group select
- Updated dependencies [1a45f93]
- Updated dependencies [1604f97]
  - @clack/core@1.0.0-alpha.3

## 1.0.0-alpha.2

### Minor Changes

- f10071e: Using the `group` method, task logs can now have groups which themselves can have scrolling windows of logs.

### Patch Changes

- 282b39e: Wrap spinner output to allow for multi-line/wrapped messages.
- 7df841d: Removed all trailing space in prompt output and fixed various padding rendering bugs.
- 17d3650: Use a default import for picocolors to avoid run time errors in some environments.
- Updated dependencies [7df841d]
  - @clack/core@1.0.0-alpha.2

## 1.0.0-alpha.1

### Minor Changes

- 7bc3301: Prompts now have a `userInput` stored separately from their `value`.
- 2837845: Adds suggestion and path prompts
- 9e5bc6c: Add support for signals in prompts, allowing them to be aborted.
- df4eea1: Remove `suggestion` prompt and change `path` prompt to be an autocomplete prompt.
- 9bd8072: Add a `required` option to autocomplete multiselect.

### Patch Changes

- bfe0dd3: Prevents placeholder from being used as input value in text prompts
- 94fee2a: Changes `placeholder` to be a visual hint rather than a tabbable value.
- Updated dependencies [bfe0dd3]
- Updated dependencies [7bc3301]
- Updated dependencies [2837845]
- Updated dependencies [34f52fe]
- Updated dependencies [94fee2a]
- Updated dependencies [4f6b3c2]
- Updated dependencies [df4eea1]
- Updated dependencies [8ead5d3]
  - @clack/core@1.0.0-alpha.1

## 1.0.0-alpha.0

### Major Changes

- c713fd5: The package is now distributed as ESM-only. In `v0` releases, the package was dual-published as CJS and ESM.

  For existing CJS projects using Node v20+, please see Node's guide on [Loading ECMAScript modules using `require()`](https://nodejs.org/docs/latest-v20.x/api/modules.html#loading-ecmascript-modules-using-require).

### Minor Changes

- 99c3530: Adds `format` option to the note prompt to allow formatting of individual lines
- 0aaee4c: Added new `taskLog` prompt for log output which is cleared on success
- 729bbb6: Add support for customizable spinner cancel and error messages. Users can now customize these messages either per spinner instance or globally via the `updateSettings` function to support multilingual CLIs.

  This update also improves the architecture by exposing the core settings to the prompts package, enabling more consistent default message handling across the codebase.

  ```ts
  // Per-instance customization
  const spinner = prompts.spinner({
    cancelMessage: "Operación cancelada", // "Operation cancelled" in Spanish
    errorMessage: "Se produjo un error", // "An error occurred" in Spanish
  });

  // Global customization via updateSettings
  prompts.updateSettings({
    messages: {
      cancel: "Operación cancelada", // "Operation cancelled" in Spanish
      error: "Se produjo un error", // "An error occurred" in Spanish
    },
  });

  // Settings can now be accessed directly
  console.log(prompts.settings.messages.cancel); // "Operación cancelada"

  // Direct options take priority over global settings
  const spinner = prompts.spinner({
    cancelMessage: "Cancelled", // This will be used instead of the global setting
  });
  ```

- 44df9af: Adds a new `groupSpacing` option to grouped multi-select prompts. If set to an integer greater than 0, it will add that number of new lines between each group.
- f2c2b89: Adds `AutocompletePrompt` to core with comprehensive tests and implement both `autocomplete` and `autocomplete-multiselect` components in prompts package.
- c45b9fb: Adds support for detecting spinner cancellation via CTRL+C. This allows for graceful handling of user interruptions during long-running operations.
- 9a09318: Adds new `progress` prompt to display a progess-bar
- 19558b9: Added support for custom frames in spinner prompt

### Patch Changes

- 46dc0a4: Fixes multiselect only shows hints on the first item in the options list. Now correctly shows hints for all selected options with hint property.
- 17342d2: Exposes a new `SpinnerResult` type to describe the return type of `spinner`
- 6868c1c: Adds a new `selectableGroups` boolean to the group multi-select prompt. Using `selectableGroups: false` will disable the ability to select a top-level group, but still allow every child to be selected individually.
- 7a556ad: Updates all prompts to accept a custom `output` and `input` stream
- 7cc8a55: Messages passed to the `stop` method of a spinner no longer have dots stripped.
- 2048eb1: Fix spinner's dots behavior with custom frames
- Updated dependencies [729bbb6]
- Updated dependencies [6868c1c]
- Updated dependencies [a4f5034]
- Updated dependencies [c713fd5]
- Updated dependencies [a36292b]
- Updated dependencies [f2c2b89]
  - @clack/core@1.0.0-alpha.0

## 0.10.0

### Minor Changes

- 613179d: Adds a new `indicator` option to `spinner`, which supports the original `"dots"` loading animation or a new `"timer"` loading animation.

  ```ts
  import * as p from "@clack/prompts";

  const spin = p.spinner({ indicator: "timer" });
  spin.start("Loading");
  await sleep(3000);
  spin.stop("Loaded");
  ```

- a38b2bc: Adds `stream` API which provides the same methods as `log`, but for iterable (even async) message streams. This is particularly useful for AI responses which are dynamically generated by LLMs.

  ```ts
  import * as p from "@clack/prompts";

  await p.stream.step(
    (async function* () {
      yield* generateLLMResponse(question);
    })()
  );
  ```

## 0.9.1

### Patch Changes

- 8093f3c: Adds `Error` support to the `validate` function
- 98925e3: Exports the `Option` type and improves JSDocannotations
- 1904e57: Replace custom utility for stripping ANSI control sequences with Node's built-in [`stripVTControlCharacters`](https://nodejs.org/docs/latest/api/util.html#utilstripvtcontrolcharactersstr) utility.
- Updated dependencies [8093f3c]
- Updated dependencies [e5ba09a]
- Updated dependencies [8cba8e3]
  - @clack/core@0.4.1

## 0.9.0

### Minor Changes

- a83d2f8: Adds a new `updateSettings()` function to support new global keybindings.

  `updateSettings()` accepts an `aliases` object that maps custom keys to an action (`up | down | left | right | space | enter | cancel`).

  ```ts
  import { updateSettings } from "@clack/prompts";

  // Support custom keybindings
  updateSettings({
    aliases: {
      w: "up",
      a: "left",
      s: "down",
      d: "right",
    },
  });
  ```

> [!WARNING]
> In order to enforce consistent, user-friendly defaults across the ecosystem, `updateSettings` does not support disabling Clack's default keybindings.

- 801246b: Adds a new `signal` option to support programmatic prompt cancellation with an [abort controller](https://kettanaito.com/blog/dont-sleep-on-abort-controller).

  One example use case is automatically cancelling a prompt after a timeout.

  ```ts
  const shouldContinue = await confirm({
    message: "This message will self destruct in 5 seconds",
    signal: AbortSignal.timeout(5000),
  });
  ```

  Another use case is racing a long running task with a manual prompt.

  ```ts
  const abortController = new AbortController();

  const projectType = await Promise.race([
    detectProjectType({
      signal: abortController.signal,
    }),
    select({
      message: "Pick a project type.",
      options: [
        { value: "ts", label: "TypeScript" },
        { value: "js", label: "JavaScript" },
        { value: "coffee", label: "CoffeeScript", hint: "oh no" },
      ],
      signal: abortController.signal,
    }),
  ]);

  abortController.abort();
  ```

- a83d2f8: Updates default keybindings to support Vim motion shortcuts and map the `escape` key to cancel (`ctrl+c`).

  | alias | action |
  | ----- | ------ |
  | `k`   | up     |
  | `l`   | right  |
  | `j`   | down   |
  | `h`   | left   |
  | `esc` | cancel |

### Patch Changes

- f9f139d: Adapts `spinner` output for static CI environments
- Updated dependencies [a83d2f8]
- Updated dependencies [801246b]
- Updated dependencies [a83d2f8]
- Updated dependencies [51e12bc]
  - @clack/core@0.4.0

## 0.8.2

### Patch Changes

- Updated dependencies [4845f4f]
- Updated dependencies [d7b2fb9]
  - @clack/core@0.3.5

## 0.8.1

### Patch Changes

- 360afeb: feat: adaptative max items

## 0.8.0

### Minor Changes

- 9acccde: Add tasks function for executing tasks in spinners

### Patch Changes

- b5c6b9b: Feat multiselect maxItems option
- 50ed94a: fix: clear `spinner` hooks on `spinner.stop`
- Updated dependencies [a04e418]
- Updated dependencies [4f6fcf5]
  - @clack/core@0.3.4

## 0.7.0

### Minor Changes

- b27a701: add maxItems option to select prompt
- 89371be: added a new method called `spinner.message(msg: string)`

### Patch Changes

- 52183c4: Fix `spinner` conflict with terminal on error between `spinner.start()` and `spinner.stop()`
- ab51d29: Fixes cases where the note title length was miscalculated due to ansi characters
- Updated dependencies [cd79076]
  - @clack/core@0.3.3

## 0.6.3

### Patch Changes

- c96eda5: Enable hard line-wrapping behavior for long words without spaces
- Updated dependencies [c96eda5]
  - @clack/core@0.3.2

## 0.6.2

### Patch Changes

- 58a1df1: Fix line duplication bug by automatically wrapping prompts to `process.stdout.columns`
- Updated dependencies [58a1df1]
  - @clack/core@0.3.1

## 0.6.1

### Patch Changes

- ca08fb6: Support complex value types for `select`, `multiselect` and `groupMultiselect`.

## 0.6.0

### Minor Changes

- 8a4a12f: add `groupMultiselect` prompt
- 165a1b3: Add `log` APIs. Supports `log.info`, `log.success`, `log.warn`, and `log.error`. For low-level control, `log.message` is also exposed.

### Patch Changes

- Updated dependencies [8a4a12f]
- Updated dependencies [8a4a12f]
  - @clack/core@0.3.0

## 0.5.1

### Patch Changes

- cc11917: Update default `password` mask
- Updated dependencies [ec812b6]
  - @clack/core@0.2.1

## 0.5.0

### Minor Changes

- d74dd05: Adds a `selectKey` prompt type
- 54c1bc3: **Breaking Change** `multiselect` has renamed `initialValue` to `initialValues`

### Patch Changes

- Updated dependencies [d74dd05]
- Updated dependencies [54c1bc3]
  - @clack/core@0.2.0

## 0.4.5

### Patch Changes

- 1251132: Multiselect: return `Value[]` instead of `Option[]`.
- 8994382: Add a password prompt to `@clack/prompts`
- Updated dependencies [1251132]
- Updated dependencies [8994382]
  - @clack/core@0.1.9

## 0.4.4

### Patch Changes

- d96071c: Don't mutate `initialValue` in `multiselect`, fix parameter type for `validate()`.

  Credits to @banjo for the bug report and initial PR!

- Updated dependencies [d96071c]
  - @clack/core@0.1.8

## 0.4.3

### Patch Changes

- 83d890e: Fix text cancel display bug

## 0.4.2

### Patch Changes

- Update README

## 0.4.1

### Patch Changes

- 7fb5375: Adds a new `defaultValue` option to the text prompt, removes automatic usage of the placeholder value.
- Updated dependencies [7fb5375]
  - @clack/core@0.1.6

## 0.4.0

### Minor Changes

- 61b88b6: Add `group` construct to group many prompts together

### Patch Changes

- de1314e: Support `required` option for multi-select
- Updated dependencies [de1314e]
  - @clack/core@0.1.5

## 0.3.0

### Minor Changes

- 493c592: Improve types for select/multiselect prompts. Numbers and booleans are now supported as the `value` option.
- 15558e3: Improved Windows/non-unicode support

### Patch Changes

- ca77da1: Fix multiselect initial value logic
- Updated dependencies [ca77da1]
- Updated dependencies [8aed606]
  - @clack/core@0.1.4

## 0.2.2

### Patch Changes

- 94b24d9: Fix CJS `ansi-regex` interop

## 0.2.1

### Patch Changes

- a99c458: Support `initialValue` option for text prompt
- Updated dependencies [a99c458]
  - @clack/core@0.1.3

## 0.2.0

### Minor Changes

- Improved type safety
- b1341d6: Updated styles, new note component

### Patch Changes

- Updated dependencies [7dcad8f]
- Updated dependencies [2242f13]
- Updated dependencies [b1341d6]
  - @clack/core@0.1.2

## 0.1.1

### Patch Changes

- fa09bf5: Use circle for radio, square for checkbox
- Updated dependencies [4be7dbf]
- Updated dependencies [b480679]
  - @clack/core@0.1.1

## 0.1.0

### Minor Changes

- 7015ec9: Create new prompt: multi-select

### Patch Changes

- Updated dependencies [7015ec9]
  - @clack/core@0.1.0

## 0.0.10

### Patch Changes

- e0b49e5: Update spinner so it actually spins

## 0.0.9

### Patch Changes

- Update README

## 0.0.8

### Patch Changes

- Updated dependencies [9d371c3]
  - @clack/core@0.0.12

## 0.0.7

### Patch Changes

- Update README

## 0.0.6

### Patch Changes

- d20ef2a: Update keywords, URLs
- Updated dependencies [441d5b7]
- Updated dependencies [d20ef2a]
- Updated dependencies [fe13c2f]
  - @clack/core@0.0.11

## 0.0.5

### Patch Changes

- Update README

## 0.0.4

### Patch Changes

- 80404ab: Update README

## 0.0.3

### Patch Changes

- a0cb382: Add `main` entrypoint
- Updated dependencies [a0cb382]
  - @clack/core@0.0.10

## 0.0.2

### Patch Changes

- Updated dependencies
  - @clack/core@0.0.9

## 0.0.1

### Patch Changes

- a4b5e13: Initial release
- Updated dependencies [a4b5e13]
  - @clack/core@0.0.8
