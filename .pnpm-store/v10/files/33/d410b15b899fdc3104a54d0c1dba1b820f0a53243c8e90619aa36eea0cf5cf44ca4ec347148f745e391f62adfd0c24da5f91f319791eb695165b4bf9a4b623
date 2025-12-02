# Switch Package Manager

[![build](https://github.com/deinsoftware/swpm/actions/workflows/build.yml/badge.svg)](https://github.com/deinsoftware/swpm/actions/workflows/build.yml)
[![publish](https://github.com/deinsoftware/swpm/actions/workflows/publish.yml/badge.svg)](https://github.com/deinsoftware/swpm/actions/workflows/publish.yml)
[![Sonar-reliability](https://sonarcloud.io/api/project_badges/measure?project=dein%3Aswpm&metric=reliability_rating)](https://sonarcloud.io/dashboard?id=dein%3Aswpm)
[![sonar-security](https://sonarcloud.io/api/project_badges/measure?project=dein%3Aswpm&metric=security_rating)](https://sonarcloud.io/dashboard?id=dein%3Aswpm)
[![sonar-maintainability](https://sonarcloud.io/api/project_badges/measure?project=dein%3Aswpm&metric=sqale_rating)](https://sonarcloud.io/dashboard?id=dein%3Aswpm)
[![sonar-coverage](https://sonarcloud.io/api/project_badges/measure?project=dein%3Aswpm&metric=coverage)](https://sonarcloud.io/dashboard?id=dein%3Aswpm)  
[![npm-version](https://img.shields.io/npm/v/swpm.svg?color=blue)](https://www.npmjs.com/package/swpm)
[![npm-downloads](https://img.shields.io/npm/dt/swpm)](https://www.npmjs.com/package/swpm)
[![node-engine](https://img.shields.io/node/v/swpm.svg?color=blue)](https://nodejs.org)
[![volta](https://img.shields.io/badge/%E2%9A%A1%20volta-compatible-blue)](https://volta.sh)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?color=yellow)](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)
[![license](https://img.shields.io/github/license/deinsoftware/swpm)](LICENSE.md)

![swpm](https://raw.githubusercontent.com/deinsoftware/swpm/main/.github/social/preview.png)

---

## Menu

- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installing](#installing)
- [swpm](#swpm)
- [swpx](#swpx)
- [Alias](#alias)
- [Flags](#flags)
- [Default](#default)
- [FAQ](#faq)
- [About](#about)

---

## Getting Started

When switching between JavaScript projects, it's often easy to forget which package manager should be used. JavaScript package managers aren't quite compatible either and each one resolves dependencies differently, so accidentally installing with [`npm`](https://docs.npmjs.com/cli/) could cause a [`yarn`](https://yarnpkg.com/) (classic or berry), [`pnpm`](https://pnpm.io/) or [`bun`](https://bun.sh/) project to break.

`swpm` is a CLI that intends to solve this problem by unifying the most used commands for the most common Node Package Managers into one. It will recognize the Package Manager used on the project and automatically will translate those commands.

This is an example of how #swpm works. The same command, no matter the package manager used on the project.

![swpm-example](https://raw.githubusercontent.com/deinsoftware/swpm/main/.github/social/example.png)

> **Note**:  
> We will start with most used command, then other commands will be added gradually.  
> Track the command progress implementation on [CHEATSHEET](CHEATSHEET.md).  
>
> Progress: **90%** of commands included.

### Prerequisites

What things you need to install?

- [node.js](https://nodejs.org)

### Installing

Install as global with any of this package managers

| Package Manager | Install Command                      |
| --------------- | ------------------------------------ |
| **npm**         | `npm install swpm --global`          |
| **yarn**        | `yarn global add swpm`               |
| **pnpm**        | `pnpm install swpm --global`         |
| **bun**         | `bun install -g swpm`                |
| **volta**       | `volta install swpm`                 |

⇧ [Back to menu](#menu)

---

## swpm

The `swpm` will run the command switching automatically searching for the `lock` file or the pinned Package Manager.

```bash
swpm [<command>] [args] [FLAGS]
```

### Help

With `swpm --help` it will show a command help resume.

```text
swpm [<command>] [args] [FLAGS]

Commands:
  swpm install [args]            install packages from package.json [aliases: i]
  swpm add <package> [args]      add package                        [aliases: a]
  swpm remove <package> [args]   remove package  [aliases: r, rm, uninstall, un]
  swpm update <package> [args]   update package                [aliases: up, ud]
  swpm upgrade <package> [args]  upgrade package to latest         [aliases: ug]
  swpm interactive [args]        update packages interactive       [aliases: ui]
  swpm open [resource] [args]    open in the file explore or browser[aliases: o]
  swpm clean [args]              clean packages                     [aliases: c]

Options:
  -u, --use    use a package manager
                           [choices: "npm", "yarn", "yarn@berry", "pnpm", "bun"]
  -p, --pin    pin a package manager
                           [choices: "npm", "yarn", "yarn@berry", "pnpm", "bun"]
      --unpin  unpin current package manager
  -t, --test   test command (without running)
                           [choices: "npm", "yarn", "yarn@berry", "pnpm", "bun"]
  -m, --mute   mute command translation
      --alias  show command alias                                      [boolean]
      --info   show information and versions                           [boolean]
      --help   Show help                                               [boolean]
```

### Commands

#### Install

By default, will install all modules listed as dependencies in `package.json`.

```bash
swpm install [args]
```

> Alias: `i`

This command installs a package and any packages that it depends on. If the package has a `lock` file, the installation of dependencies will be driven by that.

| Args             | Alias | Description                                                                   |
| ---------------- | ----- | ----------------------------------------------------------------------------- |
| `--frozen`       | `-F`  | install dependencies from lock file (without updating it). Also known as `ci` |
| `--package-lock` | `-P`  | install dependencies but don't read or generate a lockfile                    |

> **Warning**:  
> The `--package-lock` argument is not available on **bun** Package Manager.

#### Add

This command, no arguments, will add a package to local `package.json` file. Package will appear as **dependencies** by default.

```bash
swpm add <package> [args]
```

> Alias: `a`

`swpm add <package>` saves any specified packages into dependencies by default. Additionally, you can control where and how they get saved with some additional flags:

| Args              | Alias | Description                                                                                           |
| ----------------- | ----- | ----------------------------------------------------------------------------------------------------- |
| `--save-dev`      | `-D`  | Package will appear in **devDependencies**                                                            |
| `--save-optional` | `-O`  | Package will appear in **optionalDependencies**                                                       |
| `--save-peer`     |       | Package will appear in **peerDependencies**                                                           |
| `--save-exact`    | `-E`  | Dependencies will be configured with an exact version rather than using default semver range operator |
| `--global`        | `-g`  | Remove the current package context as a global package                                                |

#### Remove

This command, no arguments, will remove a package to local `package.json` file. Package will be removed as **dependencies** by default.

```bash
swpm remove <package> [args]
```

> Aliases: `r`, `rm`, `uninstall`, `un`

| Args              | Alias | Description                                            |
| ----------------- | ----- | ------------------------------------------------------ |
| `--save-dev`      | `-D`  | Package will be removed from **devDependencies**       |
| `--save-optional` | `-O`  | Package will be removed from **optionalDependencies**  |
| `--save-peer`     |       | Package will be removed from **peerDependencies**      |
| `--global`        | `-g`  | Remove the current package context as a global package |

#### Update

This command will update all the packages listed to the latest version (specified by the `tag` config), respecting the semver constraints of both your package and its dependencies (if they also require the same package). It will also install missing packages.

```bash
swpm update [<package>] [args]
```

> Aliases: `up`, `ud`

| Args              | Alias | Description                                                                                           |
| ----------------- | ----- | ----------------------------------------------------------------------------------------------------- |
| `--global`        | `-g`  | Update the current package context as a global package                                                |

> It will not made modifications on `package.json` file

#### Upgrade

This command will upgrade the packages to the latest version, ignoring ranges specified in `package.json`.

> It will save new version on `package.json` file

```bash
swpm upgrade <package> [args]
```

> Alias: `ug`

| Args              | Alias | Description                                                                                           |
| ----------------- | ----- | ----------------------------------------------------------------------------------------------------- |
| `--save-exact`    | `-E`  | Dependencies will be upgrade with an exact version rather than using default semver range operator    |
| `--global`        | `-g`  | Upgrade the current package context as a global package                                               |

> **Warning**:  
> This command is not available on **bun** Package Manager.

#### Interactive

Show outdated dependencies and select which ones to upgrade.

```bash
swpm interactive [args]
```

> Alias: `ui`

| Args              | Alias | Description                                                           |
| ----------------- | ----- | --------------------------------------------------------------------- |
| `--latest`        | `-L`  | Updates all dependencies, ignoring ranges specified in `package.json` |
| `--global`        | `-g`  | Update the current package context as a global package                |

> **Warning**:  
> This command is not available on **npm** and **bun** Package Manager.

#### Open

This command does not exist in the package managers, but is a common task open a path or urls related to the project in the file explorer or browser.

```bash
swpm open [resource] [args]
```

> Alias: `o`

| Args                     | Alias | Description                                                            |
| ------------------------ | ----- | ---------------------------------------------------------------------- |
| `--explorer [path]`      | `-E`  | Open path on file explorer (current path by default)                   |
| `--git-repo`             | `-R`  | Browse current repo on browser                                         |
| `--git-branch`           | `-B`  | Browse current branch on browser                                       |
| `--git-pipelines`        | `-P`  | Browse pipelines/actions tab of current repo on browser                |
| `--git-merge`            | `-M`  | Browse merge/pull request tab of current repo on browser               |
| `--git-diff [branch]`    | `-D`  | Browse diff current branch with another (`dev` by default)             |
| `--coverage [filePath]`  | `-C`  | Browse coverage report on browser (`./coverage/index.html` by default) |
| `--npm [package]`        | `-N`  | Browse package on nmpjs.com (current name by default)                  |

> **Info**:  
> Those `--git` flags are compatible with `GitHub`, `GitLab` and `BitBucket`.

**Examples:**

Assuming that the current path is `/path/to/project`, with `--explorer` it will open the path in the file explorer:

| Command                           | Alias            | Path                         |
| --------------------------------- | ---------------- | ---------------------------- |
| `swpm open --explorer`            | `soe`            | `/path/to/project`           |
| `swpm open --explorer .`          | `soe .`          | `/path/to/project`           |
| `swpm open --explorer subfolder`  | `soe subfolder`  | `/path/to/project/subfolder` |
| `swpm open --explorer ..`         | `soe ..`         | `/path/to`                   |
| `swpm open --explorer ...`        | `soe ...`        | `/path`                      |
| `swpm open --explorer ../another` | `soe ../another` | `/path/to/another`           |
| `swpm open --explorer /`          | `soe /`          | `/` (only on unixish OS)     |
| `swpm open --explorer ~`          | `soe ~`          | `~` (only on unixish OS)     |

Assuming the current branch is `new-feat`, with `--diff` will open the diff comparison in the browser:

| Command                     | Alias         | Diff                                        |
| --------------------------- |-------------- | ------------------------------------------- |
| `swpm open --diff`          |`sgd`          | `dev` branch vs `new-feat` branch           |
| `swpm open --diff main`     |`sgd main`     | `main` branch vs `new-feat` branch          |
| `swpm open --diff f92fbcf8` |`sgd f92fbcf8` | `f92fbcf8` commit hash vs `new-feat` branch |
| `swpm open --diff v1.0.0`   |`sgd v1.0.0`   | `v1.0.0` tag vs `new-feat` branch           |

Assuming you have generated a coverage report, with `--coverage` it will open the report in the browser:

| Command                                                 | Alias                                  | File Path                                          |
| ------------------------------------------------------- | -------------------------------------- | -------------------------------------------------- |
| `swpm open --coverage`                                  | `soc`                                  | `/path/to/project/coverage/index.html`             |
| `swpm open --coverage .`                                | `soc .`                                | Fails (also need the file name)                    |
| `swpm open --coverage ./index.html`                     | `soc ./index.html`                     | `/path/to/project/index.html`                      |
| `swpm open --coverage coverage/lcov-report/index.html`  | `soc coverage/lcov-report/index.html`  | `/path/to/project/coverage/lcov-report/index.html` |
| `swpm open --coverage ../index.html`                    | `soc ../index.html`                    | `/path/to/index.html`                              |

Assuming that the property `name` in `package.json` file is `swpm`, with `--npm` will open the package on npmjs.com:

| Command                      | Alias           | npm Url                                    |
| ---------------------------- |---------------- | ------------------------------------------ |
| `swpm open --npm`            |`son`            | `https://www.npmjs.com/package/swpm`       |
| `swpm open --npm typescript` |`son typescript` | `https://www.npmjs.com/package/typescript` |

#### Clean

This command does not exist in the package managers, but is one of the most repetitive tasks, deleting files and folders. Very useful, for example, in scenarios where you want to change completely the Package Manager.

```bash
swpm clean [args]
```

> Alias: `c`

| Args              | Alias | Description                                                                          |
| ----------------- | ----- | ------------------------------------------------------------------------------------ |
| `--modules`       |       | **node_modules**, **.yarn/cache**, **.yarn/unplugged** folders and **.pnp\*** files  |
| `--lock`          |       | **lock** files                                                                       |
| `--log`           |       | **log** files                                                                        |
| `--build`         |       | **build** folder                                                                     |
| `--coverage`      |       | **coverage** folder                                                                  |
| `--fresh`         |       | Run all args except `--lock`                                                         |
| `--all`           |       | Run all args and also delete the **.yarn** folder                                    |

> `--fresh` is a good choice when you want to clean the project and reinstall all packages again with `swpm install --frozen` and preserving the lock files intact.  
> `--all` is a good choice when you want to clean the project and migrate to a different Package Manager or reinstalling all packages and create/update the lock files.  

⇧ [Back to menu](#menu)

---

### Shared Commands

There are commands that don't need the `swpm` translation tool, because share the same structure as all package managers.

#### Init

`init` or `create` can be used to set up a new or existing package.

```bash
swpm init [--yes]
swpm create <name> [<args>]
```

> To run these commands in a path where a `package.json` didn't exist add the flag `--use <npm|yarn[@berry]|pnpm|bun>` at the end or setup an `SWPM` environment variable.

#### Login/Logout

Login and logout to [https://www.npmjs.com/](https://www.npmjs.com/).  
Commonly used when you need to publish or admin packages.

```bash
swpm login
swpm logout
```

> To run these commands in a path where a `package.json` didn't exist add the flag `--use <npm|yarn[@berry]|pnpm|bun>` at the end or setup an `SWPM` environment variable.

#### Scripts

This runs an arbitrary command from a package's "scripts" object.  
If no "command" is provided, it will list the available scripts.  

```bash
swpm run <command> [<args>]
swpm test
swpm build
```

> You can run `test` and `build` "scripts" without the `run` prefix.

#### Publish

Commands to `pack`, `publish`, `unpublish` or `deprecate` a package on [https://www.npmjs.com/](https://www.npmjs.com/).

```bash
swpm pack
swpm pack --pack-destination <path>
swpm publish
swpm unpublish <package>
swpm deprecate <package> <message>
```

#### Config

See the local configuration, or setup default values.

```bash
swpm config list
swpm config set <key> <value>
```

Example:

```bash
swpm config set save-exact true
swpm config set save-prefix '~'
```

> To run these commands in a path where a `package.json` didn't exist add the flag `--use <npm|yarn[@berry]|pnpm|bun>` at the end.

#### Versions

`outdated` will check the registry to see if any (or, specific) installed packages are currently outdated.

```bash
swpm outdated [<package>] [--global]
```

> To run this commands in a path where a `package.json` didn't exist with flag `--global` add the flag `--use <npm|yarn[@berry]|pnpm|bun>` at the end or setup an `SWPM` environment variable.

⇧ [Back to menu](#menu)

---

## swpx

The `swpx` will execute the command switching automatically to the pinned Package Manager without previous installing the package.

```bash
swpx [<command>] [FLAGS]
```

### Help

With `swpx --help` it will show a command help resume.

```text
swpx [<command>] [FLAGS]

Options:
  -u, --use    use a package manager
                           [choices: "npm", "yarn", "yarn@berry", "pnpm", "bun"]
  -t, --test   test command (without running)
                           [choices: "npm", "yarn", "yarn@berry", "pnpm", "bun"]
  -m, --mute   mute command translation
      --alias  show command alias                                      [boolean]
      --info   show information and versions                           [boolean]
      --help   Show help                                               [boolean]
```

| Package / Command | `sx <package>`       | `sx vitest`       |
| ----------------- | -------------------- | ----------------- |
| **npm**           | `npx <package>`      | `npx vitest`      |
| **yarn**          | `yarn dlx <package>` | `yarn dlx vitest` |
| **pnpm**          | `pnpm dlx <package>` | `pnpm dlx vitest` |
| **bun**           | `bunx <package>`     | `bunx vitest`     |

⇧ [Back to menu](#menu)

---

## Alias

Quick and short aliases for `swpm` and `swpx` commands.

### sp[?] (pin)

| Alias  | Command                                     |
| ------ | ------------------------------------------- |
| `sp`   | `swpm --pin <npm\|yarn[@berry]\|pnpm\|bun>` |
| `spn`  | `swpm --pin npm`                            |
| `spy`  | `swpm --pin yarn`                           |
| `spyb` | `swpm --pin yarn@berry`                     |
| `spp`  | `swpm --pin pnp`                            |
| `spb`  | `swpm --pin bun`                            |

### si (install)

| Package/Alias | `si`           |
| ------------- | -------------- |
| **npm**       | `npm install`  |
| **yarn**      | `yarn install` |
| **pnpm**      | `pnpm install` |
| **bun**       | `bun install`  |

### sif (install frozen)

| Package/Alias  | `sif`                            |
| -------------- | -------------------------------- |
| **npm**        | `npm ci`                         |
| **yarn**       | `yarn install --frozen-lockfile` |
| **yarn@berry** | `yarn install --immutable`       |
| **pnpm**       | `pnpm install --frozen-lockfile` |
| **bun**        | `bun install --frozen-lockfile`  |

### sa (add)

| Package/Alias  | `sa <package>`       | `sa vite`       |
| -------------- | -------------------- | --------------- |
| **npm**        | `npm add <package>`  | `npm add vite`  |
| **yarn**       | `yarn add <package>` | `yarn add vite` |
| **pnpm**       | `pnpm add <package>` | `pnpm add vite` |
| **bun**        | `bun add <package>`  | `bun add vite`  |

### sae (add save exact)

| Package/Alias  | `sae <package>`                   | `sae vite`                   |
| -------------- | --------------------------------- | ---------------------------- |
| **npm**        | `npm add <package> --save-exact`  | `npm add vite --save-exact`  |
| **yarn**       | `yarn add <package> --exact`      | `yarn add vite --exact`      |
| **pnpm**       | `pnpm add <package> --save-exact` | `pnpm add vite --save-exact` |
| **bun**        | `bun add <package> --save-exact`  | `bun add vite --save-exact`  |

### sad (add save dev)

| Package/Alias  | `sad <package>`                 | `sad vite`                 |
| -------------- | ------------------------------- | -------------------------- |
| **npm**        | `npm add <package> --save-dev`  | `npm add vite --save-dev`  |
| **yarn**       | `yarn add <package> --dev`      | `yarn add vite --dev`      |
| **pnpm**       | `pnpm add <package> --save-dev` | `pnpm add vite --save-dev` |
| **bun**        | `bun add <package> --save-dev`  | `bun add vite --save-dev`  |

### sade (add save dev exact)

| Package/Alias  | `sade <package>`                             | `sade vite`                             |
| -------------- | -------------------------------------------- | --------------------------------------- |
| **npm**        | `npm add <package> --save-dev --save-exact`  | `npm add vite --save-dev --save-exact`  |
| **yarn**       | `yarn add <package> --dev --exact`           | `yarn add vite --dev --exact`           |
| **pnpm**       | `pnpm add <package> --save-dev --save-exact` | `pnpm add vite --save-dev --save-exact` |
| **bun**        | `bun add <package> --save-dev --save-exact`  | `bun add vite --save-dev --save-exact`  |

### sag (add global)

| Package/Alias  | `sag <package>`                        | `sag eslint`                        |
| -------------- | -------------------------------------- | ----------------------------------- |
| **npm**        | `npm add <package> --global`           | `npm add eslint --global`           |
| **yarn**       | `yarn add global <package>`            | `yarn add global eslint`            |
| **pnpm**       | `pnpm add <package> --global`          | `pnpm add eslint --global`          |
| **bun**        | `bun add <package> --global`           | `bun add eslint --global`           |
| **volta**      | `volta install <package>`              | `volta install eslint`              |

### srm (remove)

| Package/Alias  | `srm <package>`            | `srm vite`            |
| -------------- | -------------------------- | --------------------- |
| **npm**        | `npm uninstall <package>`  | `npm uninstall vite`  |
| **yarn**       | `yarn remove <package>`    | `yarn remove vite`    |
| **pnpm**       | `pnpm uninstall <package>` | `pnpm uninstall vite` |
| **bun**        | `bun remove <package>`     | `bun remove vite`     |

### srg (remove global)

| Package/Alias  | `srg <package>`                              | `srg eslint`                              |
| -------------- | -------------------------------------------- | ----------------------------------------- |
| **npm**        | `npm uninstall <package> --global`           | `npm uninstall eslint --global`           |
| **yarn**       | `yarn remove global <package>`               | `yarn remove global eslint`               |
| **pnpm**       | `pnpm uninstall <package> --global`          | `pnpm uninstall eslint --global`          |
| **bun**        | `bun remove <package> --global`              | `bun remove eslint --global`              |
| **volta**      | `volta uninstall <package>`                  | `volta uninstall eslint`                  |

### sup (update)

| Package/Alias  | `sup [<package>]`            | `sup vite`            |
| -------------- | ---------------------------- | --------------------- |
| **npm**        | `npm update [<package>]`     | `npm update vite`     |
| **yarn**       | `yarn upgrade [<package>]`   | `yarn upgrade vite`   |
| **yarn@berry** | `yarn semver up [<package>]` | `yarn semver up vite` |
| **pnpm**       | `pnpm update [<package>]`    | `pnpm update vite`    |
| **bun**        | `bun update [<package>]`     | `bun update vite`     |

### sug (upgrade)

| Package/Alias  | `sug <package>`                   | `sug vite`                   |
| -------------- | --------------------------------- | ---------------------------- |
| **npm**        | `npm add <package>@latest`        | `npm add vite@latest`        |
| **yarn**       | `yarn upgrade <package> --latest` | `yarn upgrade vite --latest` |
| **yarn@berry** | `yarn up <package>`               | `yarn up vite`               |
| **pnpm**       | `pnpm update <package> --latest`  | `pnpm update vite --latest`  |
| **bun**        |  N/A                              |  N/A                         |

### sui (interactive)

| Package/Alias  | `sui`                       |
| -------------- | --------------------------- |
| **npm**        |  N/A                        |
| **yarn**       | `yarn upgrade-interactive`  |
| **pnpm**       | `pnpm update --interactive` |
| **bun**        |  N/A                        |

### scr (create)

| Package/Alias  | `scr <package>`         | `scr vite`         |
| -------------- | ----------------------- | ------------------ |
| **npm**        | `npm create <package>`  | `npm create vite`  |
| **yarn**       | `yarn create <package>` | `yarn create vite` |
| **pnpm**       | `pnpm create <package>` | `pnpm create vite` |
| **bun**        | `bun create <package>`  | `bun create vite`  |

### sr (run)

| Package/Alias  | `sr <script>`       | `sr dev --port 3030`         |
| -------------- | ------------------- | ---------------------------- |
| **npm**        | `npm run <script>`  | `npm run dev -- --port 3030` |
| **yarn**       | `yarn run <script>` | `yarn run dev --port 3030`   |
| **pnpm**       | `pnpm run <script>` | `pnpm run dev --port 3030`   |
| **bun**        | `bun run <script>`  | `bun run dev --port 3030`    |

### sx (execute)

| Package / Command | `sx <package>`       | `sx vitest`       |
| ----------------- | -------------------- | ----------------- |
| **npm**           | `npx <package>`      | `npx vitest`      |
| **yarn**          | `yarn dlx <package>` | `yarn dlx vitest` |
| **pnpm**          | `pnpm dlx <package>` | `pnpm dlx vitest` |
| **bun**           | `bunx <package>`     | `bunx vitest`     |

### soe (open explorer)

| Alias           | `soe [path]`                  |
| --------------- | ----------------------------- |
| **soe**         | `swpm open --explorer`        |
| **soe [path]**  | `swpm open --explorer [path]` |

### sg<?> (open git)

| Alias  | Command                    |
| ------ | -------------------------- |
| `sgr`  | `swpm open --git-repo`     |
| `sgb`  | `swpm open --git-branch`   |
| `sgp`  | `swpm open --git-pipeline` |
| `sgm`  | `swpm open --git-merge`    |

### sgd (open git-diff)

| Alias             | `sgd [branch]`                  |
| ----------------- | ------------------------------- |
| **sgd**           | `swpm open --git-diff`          |
| **sgd [branch]**  | `swpm open --git-diff [branch]` |

### soc (open coverage)

| Alias           | `soc [fileName]`                  |
| --------------- | --------------------------------- |
| **soc**         | `swpm open --coverage`            |
| **soc [path]**  | `swpm open --coverage [fileName]` |

### son (open npm package)

| Alias              | `son [package]`             |
| ------------------ | --------------------------- |
| **son**            | `swpm open --npm`           |
| **son [package]**  | `swpm open --npm [package]` |

### sc<?> (clean)

| Alias  | Command                                        |
| ------ | ---------------------------------------------- |
| `scn`  | `swpm clean --modules`                         |
| `scl`  | `swpm clean --lock`                            |
| `scb`  | `swpm clean --build`                           |
| `scd`  | `swpm clean --dist`                            |
| `scc`  | `swpm clean --coverage`                        |
| `sca`  | `swpm clean --all`                             |
| `scf`  | `swpm clean --fresh && swpm install --frozen`  |
| `sci`  | `swpm clean --all && swpm install`             |

⇧ [Back to menu](#menu)

---

## Flags

Flags are important to `swpm` and `swpx` because can modify or set his behavior.

### Use

The `<swpm|swpx> --use` flag allows you to choose your Package Manager for a project.

```bash
swpm <command> [args] --use <npm|yarn[@berry]|pnpm|bun>
swpx <command> [args] -u <npm|yarn[@berry]|pnpm|bun>
```

It will run the command using the selected Package Manager, no matter the `swpm` property in your `package.json`.

> **Info**:  
> Previously it will ask to run the set command when use `yarn`:  
> `yarn set version classic` for `yarn`
> `yarn set version berry` for `yarn@berry`

### Pin

The `swpm --pin` flag allows you to choose your Package Manager for a project.

```bash
swpm --pin <npm|yarn[@berry]|pnpm|bun>
swpm -p <npm|yarn[@berry]|pnpm|bun>
```

It will store the pinned Package Manager in the `package.json` file, so you can commit your choice of tools to version control:

```diff
{
+ "swpm": "<package-manager-name>"
}
```

> **Info**:  
> Additionally it will ask to run the set command when pin `yarn`:  
> `yarn set version classic` for `yarn`
> `yarn set version berry` for `yarn@berry`

You also can set it manually. Just take care writing a valid Package Manager: `npm`, `yarn[@berry]`, `pnpm` or `bun`. And also remember to run the set command for `yarn` projects.

### Unpin

The `swpm --unpin` flag allows you to remove the current pinned Package Manager for a project.

```bash
swpm --unpin
```

It will remove the pinned Package Manager in the `package.json` file.

#### Test

The `<swpm|swpx> --test` flag show the equivalent command using the selected Package Manager, but **it will not run the command**

```bash
swpm <command> [args] --test <npm|yarn[@berry]|pnpm|bun>
swpm <command> [args] -t <npm|yarn[@berry]|pnpm|bun>
swpx <command> -t <npm|yarn[@berry]|pnpm|bun>
```

It will show the command using the selected Package Manager, no matter the `swpm` property in your `package.json`.

#### Mute

The `<swpm|swpx> --mute` flag hide the package manager command translation.

```bash
swpm <command> [args] --mute
swpx <command> [args] --mute
```

#### Alias

The `<swpm|swpx> --alias` flag show the command aliases available.

```bash
swpm --alias
swpx --alias
```

#### Info

The `<swpm|swpx> --info` flag show the current Package Manager used and some versions information.

```bash
swpm --info
swpx --info
```

It will search firs the `swpm` property on the `package.json` file, and if doesn't not found it, will try to infer the Package Manager in use with help of the `lock`'s file.

⇧ [Back to menu](#menu)

---

### Default

You can set a default or **global** pin Package Manager in order to avoid the `--use` flag on paths where no exist a `package.json` or `--pin` flag on each project.

Create an `SWPM` environment variable with one of this values `<npm|yarn[@berry]|pnpm|bun>`.

| OS    | Command                                                                              |
| ----- | ------------------------------------------------------------------------------------ |
| win   | `setx SWPM "<npm\|yarn[@berry]\|pnpm\|bun>"`                                         |
| macOS | `echo 'export SWPM="<npm\|yarn[@berry]\|pnpm\|bun>"' >> <~/.bash_profile\|~/.zshrc>` |
| linux | `echo 'export SWPM="<npm\|yarn[@berry]\|pnpm\|bun>"' >> <~/.bash_profile\|~/.zshrc>` |

⇧ [Back to menu](#menu)

---

## FAQ

### How infer the Package Manager?

`swpm` and `swpx` search some characteristics following this order.

| Icon | Stage    |
| :--: | ------------------------------------------------------------ |
| 📌   | Search the `swpm` property pinned on `package.json` file     |
| 📦   | Search the `packageManager` property on `package.json` file  |
| 🔒   | Search for a `lock` file                                     |
| 🌐   | Search a `SWPM` environment variable                         |

### What can I use as Package parameter?

The `<package>` parameter should follow one of these structures:

```bash
[<@scope>/]<name>
[<@scope>/]<name>@<tag>
[<@scope>/]<name>@<version>
[<@scope>/]<name>@<version range>
<alias>@npm:<name>
<git-host>:<git-user>/<repo-name>
<git repo url>
<tarball file>
<tarball url>
<folder>
```

### Monorepos

`swpm` is compatible with monorepos. You can run it from any subdirectory and it will search upwards until it finds the closest `package.json` and `lock` file.

### Non documented commands

`swpm` is not restrictive, if a command translations was not included yet, you can write the command as the package manager expect, then `swpm` will try to infer the package manager and preserve the rest of the command and arguments without changes and run them.

But, if you found one of this cases, please open a [command compatibility](https://github.com/deinsoftware/swpm/issues/new?assignees=&labels=command-request&template=command-compatibility.md&title=) issue.

### Alternatives

A minimalistic solution focus only in the most common used commands:

- [antfu/ni](https://github.com/antfu/ni) use the right package manager

⇧ [Back to menu](#menu)

---

## About

### Built With

- [VS Code](https://code.visualstudio.com/) - Code editing redefined.
- [TypeScript](https://www.typescriptlang.org) - JavaScript With Syntax For Types.
- [WSL](https://docs.microsoft.com/en-us/windows/wsl/) - Windows Subsystem for Linux.
- [Windows Terminal](https://github.com/Microsoft/Terminal/) - A modern terminal application for users of command-line tools and shells.
- [Node.js](https://nodejs.org/) - A JavaScript runtime built on Chrome's V8 JavaScript engine.
- [ESLint](https://eslint.org/) - Find and fix problems in your JavaScript code.
- [vitest](https://vitest.dev/) - A blazing fast unit-test framework powered by Vite ⚡️.
- [Codeium](https://codeium.com/) - Free AI code completion and chat.

### NPM Packages

- [Chalk](https://www.npmjs.com/package/chalk) - Terminal string styling done right.
- [command-exists](https://www.npmjs.com/package/command-exists) - node module to check if a command-line command exists.
- [common-tags](https://www.npmjs.com/package/common-tags) - A set of well-tested, commonly used template literal tag functions for use in ES2015+.
- [find-up](https://www.npmjs.com/package/find-up) - Find a file or directory by walking up parent directories.
- [open](https://www.npmjs.com/package/open) - Open stuff like URLs, files, executables. Cross-platform.
- [prompts](https://www.npmjs.com/package/prompts) - Lightweight, beautiful and user-friendly interactive prompts
- [semver](https://www.npmjs.com/package/semver) - The semantic versioner for npm.
- [spinnies](https://www.npmjs.com/package/spinnies)  create and manage multiple spinners in CLI progrags
- [update-notifier](https://www.npmjs.com/package/update-notifier) - Update notifications for your CLI app.
- [Yargs](https://yargs.js.org/) - Yargs be a node.js library fer hearties tryin' ter parse optstrings.

### Contributing

Please read [CONTRIBUTING](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

### Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [swpm](https://github.com/deinsoftware/swpm/tags) on GitHub.

### Brand

If you want to help, spread the word of `swpm` in a project or web, please use this [BRAND](BRAND.md)'s images.

### Authors

- **Camilo Martinez** [[Equiman](http://github.com/equiman)]

### Contributors

[![equiman](https://avatars.githubusercontent.com/u/933393?s=60&v=4)](https://github.com/equiman)
[![TylerBarnes](https://avatars.githubusercontent.com/u/14190743?s=60&v=4)](https://github.com/TylerBarnes)

See also the list of [contributors](https://github.com/deinsoftware/swpm/contributors) who participated in this project.

### Sponsors

If this project helps you, consider buying me a cup of coffee.

[![GitHub Sponsors](https://img.shields.io/badge/-GitHub%20Sponsors-gray?style=flat&labelColor=171515&logo=github&logoColor=white&link=https://github.com/sponsors/deinsoftware)](https://github.com/sponsors/deinsoftware)
[![paypal](https://img.shields.io/badge/-PayPal-gray?style=flat&labelColor=00457C&logo=paypal&logoColor=white&link=https://paypal.me/equiman/3)](https://paypal.me/equiman/3)

### License

This project is licensed under the MIT License - see the [LICENSE](LICENSE.md) file for details.

⇧ [Back to menu](#menu)
