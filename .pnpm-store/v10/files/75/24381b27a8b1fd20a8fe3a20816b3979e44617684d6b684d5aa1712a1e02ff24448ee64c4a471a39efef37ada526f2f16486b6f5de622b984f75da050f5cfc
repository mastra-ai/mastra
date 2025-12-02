# @clack/core

## 1.0.0-alpha.6

### Patch Changes

- b103ad3: Allow disabled options in multi-select and select prompts.

## 1.0.0-alpha.5

### Minor Changes

- 55645c2: Support wrapping autocomplete and select prompts.

### Patch Changes

- 71b5029: Add missing nullish checks around values.
- 2310b43: Allow custom writables as output stream.

## 1.0.0-alpha.4

### Patch Changes

- d98e033: add invert selection for multiselect prompt

## 1.0.0-alpha.3

### Minor Changes

- 1604f97: Add `clearOnError` option to password prompt to automatically clear input when validation fails

### Patch Changes

- 1a45f93: Switched from wrap-ansi to fast-wrap-ansi

## 1.0.0-alpha.2

### Patch Changes

- 7df841d: Removed all trailing space in prompt output and fixed various padding rendering bugs.

## 1.0.0-alpha.1

### Minor Changes

- 7bc3301: Prompts now have a `userInput` stored separately from their `value`.
- 2837845: Adds suggestion and path prompts
- df4eea1: Remove `suggestion` prompt and change `path` prompt to be an autocomplete prompt.

### Patch Changes

- bfe0dd3: Prevents placeholder from being used as input value in text prompts
- 34f52fe: Validates initial values immediately when using text prompts with initialValue and validate props.
- 94fee2a: Changes `placeholder` to be a visual hint rather than a tabbable value.
- 4f6b3c2: Set initial values of auto complete prompt to first option when multiple is false.
- 8ead5d3: Avoid passing initial values to core when using auto complete prompt

## 1.0.0-alpha.0

### Major Changes

- c713fd5: The package is now distributed as ESM-only. In `v0` releases, the package was dual-published as CJS and ESM.

  For existing CJS projects using Node v20+, please see Node's guide on [Loading ECMAScript modules using `require()`](https://nodejs.org/docs/latest-v20.x/api/modules.html#loading-ecmascript-modules-using-require).

### Minor Changes

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

- f2c2b89: Adds `AutocompletePrompt` to core with comprehensive tests and implement both `autocomplete` and `autocomplete-multiselect` components in prompts package.

### Patch Changes

- 6868c1c: Adds a new `selectableGroups` boolean to the group multi-select prompt. Using `selectableGroups: false` will disable the ability to select a top-level group, but still allow every child to be selected individually.
- a4f5034: Fixes an edge case for placeholder values. Previously, when pressing `enter` on an empty prompt, placeholder values would be ignored. Now, placeholder values are treated as the prompt value.
- a36292b: Fix "TTY initialization failed: uv_tty_init returned EBADF (bad file descriptor)" error happening on Windows for non-tty terminals.

## 0.4.1

### Patch Changes

- 8093f3c: Adds `Error` support to the `validate` function
- e5ba09a: Fixes a cursor display bug in terminals that do not support the "hidden" escape sequence. See [Issue #127](https://github.com/bombshell-dev/clack/issues/127).
- 8cba8e3: Fixes a rendering bug with cursor positions for `TextPrompt`

## 0.4.0

### Minor Changes

- a83d2f8: Adds a new `updateSettings()` function to support new global keybindings.

  `updateSettings()` accepts an `aliases` object that maps custom keys to an action (`up | down | left | right | space | enter | cancel`).

  ```ts
  import { updateSettings } from "@clack/core";

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

- a83d2f8: Updates default keybindings to support Vim motion shortcuts and map the `escape` key to cancel (`ctrl+c`).

  | alias | action |
  | ----- | ------ |
  | `k`   | up     |
  | `l`   | right  |
  | `j`   | down   |
  | `h`   | left   |
  | `esc` | cancel |

### Patch Changes

- 51e12bc: Improves types for events and interaction states.

## 0.3.5

### Patch Changes

- 4845f4f: Fixes a bug which kept the terminal cursor hidden after a prompt is cancelled
- d7b2fb9: Adds missing `LICENSE` file. Since the `package.json` file has always included `"license": "MIT"`, please consider this a licensing clarification rather than a licensing change.

## 0.3.4

### Patch Changes

- a04e418: fix(@clack/core): keyboard input not working after await in spinner
- 4f6fcf5: feat(@clack/core): allow tab completion for placeholders

## 0.3.3

### Patch Changes

- cd79076: fix: restore raw mode on unblock

## 0.3.2

### Patch Changes

- c96eda5: Enable hard line-wrapping behavior for long words without spaces

## 0.3.1

### Patch Changes

- 58a1df1: Fix line duplication bug by automatically wrapping prompts to `process.stdout.columns`

## 0.3.0

### Minor Changes

- 8a4a12f: Add `GroupMultiSelect` prompt

### Patch Changes

- 8a4a12f: add `groupMultiselect` prompt

## 0.2.1

### Patch Changes

- ec812b6: fix `readline` hang on Windows

## 0.2.0

### Minor Changes

- d74dd05: Adds a `selectKey` prompt type
- 54c1bc3: **Breaking Change** `multiselect` has renamed `initialValue` to `initialValues`

## 0.1.9

### Patch Changes

- 1251132: Multiselect: return `Value[]` instead of `Option[]`.
- 8994382: Add a password prompt to `@clack/prompts`

## 0.1.8

### Patch Changes

- d96071c: Don't mutate `initialValue` in `multiselect`, fix parameter type for `validate()`.

  Credits to @banjo for the bug report and initial PR!

## 0.1.7

### Patch Changes

- 6d9e675: Add support for neovim cursor motion (`hjkl`)

  Thanks [@esau-morais](https://github.com/esau-morais) for the assist!

## 0.1.6

### Patch Changes

- 7fb5375: Adds a new `defaultValue` option to the text prompt, removes automatic usage of the placeholder value.

## 0.1.5

### Patch Changes

- de1314e: Support `required` option for multi-select

## 0.1.4

### Patch Changes

- ca77da1: Fix multiselect initial value logic
- 8aed606: Fix `MaxListenersExceededWarning` by detaching `stdin` listeners on close

## 0.1.3

### Patch Changes

- a99c458: Support `initialValue` option for text prompt

## 0.1.2

### Patch Changes

- Allow isCancel to type guard any unknown value
- 7dcad8f: Allow placeholder to be passed to TextPrompt
- 2242f13: Fix multiselect returning undefined
- b1341d6: Improved placeholder handling

## 0.1.1

### Patch Changes

- 4be7dbf: Ensure raw mode is unset on submit
- b480679: Preserve value if validation fails

## 0.1.0

### Minor Changes

- 7015ec9: Create new prompt: multi-select

## 0.0.12

### Patch Changes

- 9d371c3: Fix rendering bug when using y/n to confirm

## 0.0.11

### Patch Changes

- 441d5b7: fix select return undefined
- d20ef2a: Update keywords, URLs
- fe13c2f: fix cursor missing after submit

## 0.0.10

### Patch Changes

- a0cb382: Add `main` entrypoint

## 0.0.9

### Patch Changes

- Fix node@16 issue (cannot read "createInterface" of undefined)

## 0.0.8

### Patch Changes

- a4b5e13: Bug fixes, exposes `block` utility

## 0.0.7

### Patch Changes

- Fix cursor bug

## 0.0.6

### Patch Changes

- Fix error with character check

## 0.0.5

### Patch Changes

- 491f9e0: update readme

## 0.0.4

### Patch Changes

- 7372d5c: Fix bug with line deletion

## 0.0.3

### Patch Changes

- 5605d28: Do not bundle dependencies (take II)

## 0.0.2

### Patch Changes

- 2ee67cb: don't bundle deps

## 0.0.1

### Patch Changes

- 306598e: Initial publish, still WIP
