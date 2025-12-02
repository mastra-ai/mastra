## @changesets/cli 🦋

[![npm package](https://img.shields.io/npm/v/@changesets/cli)](https://npmjs.com/package/@changesets/cli)
[![View changelog](https://img.shields.io/badge/Explore%20Changelog-brightgreen)](./CHANGELOG.md)

The primary implementation of [changesets](https://github.com/changesets/changesets). Helps you manage the versioning
and changelog entries for your packages, with a focus on versioning within a mono-repository (though we support
single-package repositories too).

This package is intended as a successor to `@atlaskit/build-releases` with a more general focus. It works in
[bolt](https://www.npmjs.com/package/bolt) multi-package repositories, [yarn workspaces](https://classic.yarnpkg.com/en/docs/workspaces/) multi-package repositories, and
in single-package repositories.

## Getting Started

If you are installing this in a monorepo run

```shell
yarn add @changesets/cli
yarn changeset init
```

otherwise run

```shell
yarn add --dev @changesets/cli
yarn changeset init
```

From here you are set up to use changesets. Add your first changeset by running

```shell
yarn changeset
```

and following the prompts that you are presented with.

Below you can find a basic workflow for maintainers to help them use changesets, which you can vary to meet your own needs.

## Core Concepts

The core concept that `changesets` follows is that contributors to a repository should be able to declare an intent to release, and that multiple intents should be able to be combined sensibly. Sensibly here refers to if there is one intent to release button as a 'minor' and another to release button as a 'patch', only one release will be made, at the higher of the two versions.

A single `changeset` is an intent to release stored as data, with the information we need to combine multiple changesets and coordinate releases. It will also update internal dependencies within a multi-package repository.

## Base workflow

Contributor runs:

```shell
yarn changeset
```

or

```shell
npx @changesets/cli
```

and answers the provided questions.

When the maintainer wants to release packages, they should run

```shell
yarn changeset version
```

or

```shell
npx @changesets/cli version
```

and then

```shell
yarn changeset publish
```

or

```shell
npx @changesets/cli publish
```

The commands are explained further below.

## Commands

### init

```shell
changeset init
```

This command sets up the `.changeset` folder. It generates a readme and a config file. The config file includes the default options, as well as comments on what these options represent. You should run this command once, when you are setting up `changesets`.

To publish public packages to NPM, you'll need to edit `.changeset/config.json` and change `"access": "restricted",` to `"access": "public",`. Read more about [access in config file options](https://github.com/changesets/changesets/blob/main/docs/config-file-options.md#access-restricted--public). The `publishConfig` of each `package.json` is also respected and takes a priority over monorepo-wide setting in `.changeset/config.json`.

### add

```shell
changeset [--empty] [--open]
```

or

```shell
changeset add [--empty] [--open]
```

This command will ask you a series of questions, first about what packages you want to release, then what semver bump type for each package, then it will ask for a summary of the entire changeset. At the final step it will show the changeset it will generate, and confirm that you want to add it.

Once confirmed, the changeset will write a Markdown file that contains the summary and YAML front matter which stores the packages that will be released and the semver bump types for them.

A changeset that major bumps `@changesets/cli` would look like this:

```md
---
"@changesets/cli": major
---

A description of the major changes.
```

If you want to modify this file after it's generated, that's completely fine or if you want to write changeset files yourself, that's also fine.

- `--empty` - allows you to create an empty changeset if no packages are being bumped, usually only required if you have CI that blocks merges without a changeset.

A changeset created with the `empty` flag would look like this:

```md
---
---
```

If you set the `commit` option in the config, the command will add the updated changeset files and then commit them.

- `--open` - opens the created changeset in an external editor

### version

```shell
changeset version
```

Updates the versions for all packages described in changesets since last release along with any dependents inside the repo that are out of range.

Will also create/append to a CHANGELOG file for each package using the summaries from the changesets.

We recommend making sure changes made from this command are merged back into the base branch before you run `publish`.

This command will read then delete changesets on disk, ensuring that they are only used once.

### publish

```shell
changeset publish [--otp={token}]
```

Publishes to NPM repo, and creates git tags. Because this command assumes that last commit is the release commit you should not commit any changes between calling `version` and `publish`. These commands are separate to enable you to check if release commit is accurate.

- `--otp={token}` - allows you to provide an npm one-time password if you have auth and writes enabled on npm. The CLI also prompts for the OTP if it's not provided with the `--otp` option.

**NOTE:** You will still need to push your changes back to the base branch after this

```shell
git push --follow-tags
```

### status

```shell
changeset status [--verbose] [--output={filePath}] [--since={gitTag}]
```

The status command provides information about the changesets that currently exist. If there are changes to packages but no changesets are present, it exits with error status code `1`.

- `--verbose` - use if you want to know the new versions, and get a link to the relevant changeset summary.

- `--output` - allows you to write the json object of the status out, for consumption by other tools, such as CI.

- `--since` - to only display information about changesets since a specific branch or git tag. While this can be
  used to add a CI check for changesets, we recommend not doing this. We instead recommend using the [changeset bot](https://github.com/apps/changeset-bot)
  to detect pull requests missing changesets, as not all pull requests need one.

### pre

```shell
changeset pre [exit|enter {tag}]
```

The pre command enters and exits pre mode. The command does not do any actual versioning, when doing a prerelease, you should run `changeset pre enter next`(or a different tag, the tag is what is in versions and is the npm dist tag) and then do the normal release process with `changeset version` and `changeset publish`. For more information about the pre command, see [the prereleases documentation](https://github.com/changesets/changesets/blob/main/docs/prereleases.md).

### Bumping peerDependencies

In almost all circumstances, internal packages will be bumped as a patch. The one exception is when the dependency is a `peerDependency`, in which case the change will become a major.
