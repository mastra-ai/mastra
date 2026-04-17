# License

This package is licensed under the **Mastra Enterprise Edition (EE) License**.

- The canonical EE license text lives at the root of the repository in [`ee/LICENSE`](../../ee/LICENSE).
- All source code in this package is distributed under that license.

## Directory map

| Path | License |
| ---- | ------- |
| `ee/**` | Mastra Enterprise License (see `../../ee/LICENSE`) |
| `src/**` | Mastra Enterprise License (re-exports from `ee/**`) |

## Runtime gating

The functionality in this package requires a valid `MASTRA_EE_LICENSE` environment
variable in production. In development and test environments the feature is
available without a license per the terms in `../../ee/LICENSE`.
