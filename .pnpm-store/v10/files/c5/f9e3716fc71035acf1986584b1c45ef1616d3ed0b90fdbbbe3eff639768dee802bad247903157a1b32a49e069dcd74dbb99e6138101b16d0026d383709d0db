# Server

This is the entry point for all of the code for use within query and mutation
functions.

This directory uses an "interface-impl" pattern where:

- The main directory has all interfaces to define the types of the various
  abstractions. These are parameterized of the developers `DataModel` type and
  carefully written to only allow valid usage.
- The `impl/` subdirectory has implementations of all of these interfaces. These
  implementations are sloppier about their types and **not parameterized over
  `DataModel`**. This simplifies their implementation and only gives up a bit of
  type safety. The `DataModel` type is built to help developers write correct
  code, not to check that our internal structures are correct.
