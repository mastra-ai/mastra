# node-api-headers

- **[Introduction](#introduction)**
- **[Contributing](CONTRIBUTING.md)**
- **[Code of Conduct](CODE_OF_CONDUCT.md)**
- **[Install](#install)**
- **[API](#api)**
- **[Creating a release](CREATING_A_RELEASE.md)**
- **[Team](#team)**
- **[License](#license)**

## Current Node-API version: 9

(See [CHANGELOG.md](CHANGELOG.md) for complete Changelog)

<a name="introduction"></a>

## Introduction

**node-api-headers** contains the header files for the C-based Node-API
provided by Node.js. Node-API is an API for building native addons that
guarantees the ABI (Application Binary Interface) stability across versions
of Node.js (see: [Node-API](https://nodejs.org/dist/latest/docs/api/n-api.html)).

Node-API headers are in the `include` folder. The Node-APIs that provide
ECMAScript features from native code can be found in `js_native_api_types.h`
and `js_native_api.h`. The APIs defined in these headers are included in
`node_api_types.h` and `node_api.h`.
The headers are structured in this way in order to allow implementations of
Node-API outside of Node.js considering that for those implementations the
Node.js specific APIs may not be applicable.

**node-api-headers** is also a package published on **npm** that could be used
in a process to compile and build native addons for Node.js.

<a name="install"></a>

## Install

```
npm i node-api-headers
```

<a name="versions"></a>

## Versions

Node-API C headers are backward-compatible. Its version (e.g. `8`) is released 
separately from the Node.js version stream (e.g. `19.8.1`) and changes are 
backported to active Node.js LTS lines (e.g. `16.x` and `18.x`).

This package publishes semver-minor versions with new Node-API C headers changes.
JS API breaking changes are published with new semver-major versions.

<a name="api"></a>

## API

The module exports two properties `include_dir` and `symbols`.
### `include_dir`

This property is a string that represents the include path for the Node-API
headers.

### `def_paths`

This property is an object that has two keys `js_native_api_def` and
`node_api_def` which represents the path of the module definition file for the
`js_native_api` and `node_api` respectively.

### `symbols`

This property is an object that represents the symbols exported by Node-API
grouped by version and api types.

```js
    V1: {
        js_native_api_symbols: [
            // List of symbols in js_native_api.h for the version 1.
        ],
        node_api_symbols: [
          // List of symbols in node_api.h for the version 1
        ]
    },
   // ...
```

<a name="team"></a>

## Team members

### Active
| Name                | GitHub Link                                           |
| ------------------- | ----------------------------------------------------- |
| Anna Henningsen     | [addaleax](https://github.com/addaleax)               |
| Chengzhong Wu       | [legendecas](https://github.com/legendecas)           |
| Gabriel Schulhof    | [gabrielschulhof](https://github.com/gabrielschulhof) |
| Hitesh Kanwathirtha | [digitalinfinity](https://github.com/digitalinfinity) |
| Jim Schlight        | [jschlight](https://github.com/jschlight)             |
| Michael Dawson      | [mhdawson](https://github.com/mhdawson)               |
| Kevin Eady          | [KevinEady](https://github.com/KevinEady)
| Nicola Del Gobbo    | [NickNaso](https://github.com/NickNaso)               |

<a name="license"></a>

Licensed under [MIT](./LICENSE.md)
