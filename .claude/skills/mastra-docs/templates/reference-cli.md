# CLI reference page template

Guide: `references/REFERENCE.md`.

## Purpose

Answers: "What does this command do, and which arguments and flags does it accept?"

Use it for a CLI binary or command under `/reference/cli`, such as `create-mastra` or `mastra dev`.

Don't use it for:

- a walkthrough that uses the command to reach a goal (use `how-to.md` or `quickstart.md`, and link here);
- programmatic APIs (use `reference-api.md`);
- flags that are hidden, internal, or not supported for users.

## Title grammar

- `title` follows `Reference: $COMMAND | CLI`, such as `Reference: create-mastra | CLI`.
- The H1 is the command exactly as typed, such as `create-mastra` or `mastra dev`.

## Frontmatter

In the skeleton, `$CLI_PACKAGE` is the npm package that provides the command (`create-mastra`, `mastra`), and `$SUBCOMMAND` is the rest of the command (`dev`). Leave `$SUBCOMMAND` empty for a standalone command such as `create-mastra`. Set `$VERSION` to `@latest` only for bootstrap commands that run before a project exists, such as `npx create-mastra@latest` or `npx mastra@latest init`. Leave it empty for project commands such as `npx mastra dev`, so they run the CLI version the project installed.

```yaml
---
title: 'Reference: $COMMAND | CLI'
description: '$VERB with $COMMAND. Learn its arguments, flags, and behavior.'
packages:
  - '$CLI_PACKAGE'
---
```

## Skeleton

````mdx
---
title: 'Reference: $COMMAND | CLI'
description: '$VERB with $COMMAND. Learn its arguments, flags, and behavior.'
packages:
  - '$CLI_PACKAGE'
---

# $COMMAND

Say what the command does and what it creates or changes.

```bash npm2yarn
npx $CLI_PACKAGE$VERSION $SUBCOMMAND
```

## $MODE_OR_BEHAVIOR

Describe each mode or major behavior, with one example command each. Remove this section for a single-purpose command.

```bash npm2yarn
npx $CLI_PACKAGE$VERSION $SUBCOMMAND $ARGUMENT --$FLAG $VALUE
```

## Arguments and flags

<PropertiesTable
  content={[
    {
      name: '[$ARGUMENT]',
      type: 'string',
      description: 'What the argument is, and what happens when it is omitted.',
      isOptional: true,
    },
    {
      name: '-$SHORT, --$FLAG <$VALUE>',
      type: 'string',
      description: 'What the flag controls. List accepted values.',
      isOptional: true,
      defaultValue: '$DEFAULT',
    },
  ]}
/>

## Environment variables

List variables the command reads or writes. Remove this section if there are none.

## Related

- [$TASK_PAGE](/docs/$CATEGORY/$TASK_PAGE)
````

`PropertiesTable` is available globally in MDX and needs no import.

## Self-review checklist

Run `CHECKLIST.md`, then:

- [ ] Is every argument and flag checked against the CLI source, including short aliases, accepted values, and defaults?
- [ ] Do flag names in `PropertiesTable` match the CLI's own syntax, such as `-l, --llm <provider>`?
- [ ] Do commands use `bash npm2yarn` when they run through a package manager?
- [ ] Does the page say which files, environment variables, or remote resources the command creates or changes?
- [ ] Does it state prompts and non-interactive alternatives?

## Example

`docs/src/content/en/reference/cli/create-mastra.mdx`
