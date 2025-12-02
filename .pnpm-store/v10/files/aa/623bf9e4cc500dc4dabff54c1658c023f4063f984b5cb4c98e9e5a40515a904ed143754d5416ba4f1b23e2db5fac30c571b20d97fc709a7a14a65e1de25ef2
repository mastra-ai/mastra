# Contributing to LanceDB Typescript

This document outlines the process for contributing to LanceDB Typescript.
For general contribution guidelines, see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Project layout

The Typescript package is a wrapper around the Rust library, `lancedb`. We use
the [napi-rs](https://napi.rs/) library to create the bindings between Rust and
Typescript.

* `src/`: Rust bindings source code
* `lancedb/`: Typescript package source code
* `__test__/`: Unit tests
* `examples/`: An npm package with the examples shown in the documentation

## Development environment

To set up your development environment, you will need to install the following:

1. Node.js 14 or later
2. Rust's package manager, Cargo. Use [rustup](https://rustup.rs/) to install.
3. [protoc](https://grpc.io/docs/protoc-installation/) (Protocol Buffers compiler)

Initial setup:

```shell
npm install
```

### Commit Hooks

It is **highly recommended** to install the [pre-commit](https://pre-commit.com/) hooks to ensure that your
code is formatted correctly and passes basic checks before committing:

```shell
pre-commit install
```

## Development

Most common development commands can be run using the npm scripts.

Build the package

```shell
npm install
npm run build
```

Lint:

```shell
npm run lint
```

Format and fix lints:

```shell
npm run lint-fix
```

Run tests:

```shell
npm test
```

To run a single test:

```shell
# Single file: table.test.ts
npm test -- table.test.ts
# Single test: 'merge insert' in table.test.ts
npm test -- table.test.ts --testNamePattern=merge\ insert
```
