# find-workspaces ![npm downloads](https://img.shields.io/npm/dw/find-workspaces) [![Coverage Status](https://coveralls.io/repos/github/joshuajaco/find-workspaces/badge.svg)](https://coveralls.io/github/joshuajaco/find-workspaces) [![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

Find all the workspaces of a monorepo.

It supports:

- [Yarn workspaces](https://classic.yarnpkg.com/en/docs/workspaces)
- [npm workspaces](https://docs.npmjs.com/cli/v7/using-npm/workspaces)
- [pnpm workspaces](https://pnpm.io/workspaces)
- [lerna](https://github.com/lerna/lerna)
- [bolt](https://github.com/boltpkg/bolt)

## Installation

```sh
# npm
npm i find-workspaces

# yarn
yarn add find-workspaces

# pnpm
pnpm add find-workspaces
```

## Usage

```javascript
// esm
import { findWorkspaces } from "find-workspaces";
// commonjs
const { findWorkspaces } = require("find-workspaces");

const workspaces = findWorkspaces();

console.log(workspaces);
```

## API

### findWorkspaces(dirname, options)

Finds all workspaces.  
Returns [`Workspace[]`](#workspace) or `null` if `dirname` is not inside a monorepo.

#### dirname

Type: `string | undefined`  
Default: `process.cwd()`

The directory to start searching for the monorepo root.

#### Options

Type: `Options`  
Default: `{}`

See [`Options`](#options-2)

### findWorkspacesRoot(dirname, options)

Finds the monorepo root.
Returns [`WorkspacesRoot`](#workspaceroot) or `null` if `dirname` is not inside a monorepo.

#### dirname

Type: `string | undefined`  
Default: `process.cwd()`

The directory to start searching for the monorepo root.

#### Options

Type: `Options`  
Default: `{}`

See [`Options`](#options-2)

### createWorkspacesCache()

Returns a cache which can be provided to [`findWorkspaces`](#findworkspacesdirname-options) and [`findWorkspacesRoot`](#findworkspacesrootdirname-options).

### Options

#### stopDir

Type: `string | undefined`  
Default: `os.homedir()`

The directory to stop searching for the monorepo root.  
The provided directory will not be included in the search.

#### cache

Type: `Cache | undefined`

An optional cache created by [`createWorkspacesCache`](#createworkspacescache).

### Workspace

#### location

Type: `string`

The location of the workspace as an absolute path.

#### package

Type: [`PackageJson`](https://github.com/sindresorhus/type-fest/blob/main/source/package-json.d.ts)

The parsed `package.json` file of the workspace.

### WorkspaceRoot

#### location

Type: `string`

The location of the workspace as an absolute path.

#### globs

Type: `string[]`

A list of the glob patterns used to define the workspaces.

## License

[MIT](https://github.com/joshuajaco/find-workspaces/blob/main/LICENSE)
