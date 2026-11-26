# Testing

Run commands from the template directory using the Node version in `.nvmrc`. Install with `npm install --workspaces=false`.

## Start with local checks

```sh
npm run format
npm run check:console
npm run test:unit
npm run test:console:unit
```

`format` checks without writing; use `npx oxfmt <path>` to format edited files. `check:console` checks backend and browser types and builds the console. For backend-only changes, `npm run typecheck` is the narrower option.

## Choose an integration suite

Run Docker suites sequentially with the daemon available and the normal listener stopped. Tests use temporary databases, owned targets, and local model/feed fixtures. They need no Morph key and don't contact the real advisory feed. Use a shell without exported production credentials.

| Area changed                               | Command                            |
| ------------------------------------------ | ---------------------------------- |
| Runtime setup and sandbox                  | `npm run test:integration`         |
| Sessions, policies, revisions, credentials | `npm run test:control-plane`       |
| HTTP/headless discovery and cancellation   | `npm run test:discovery`           |
| Gateway scope, TLS, DNS, network isolation | `npm run test:gateway`             |
| Offline knowledge and advisory import      | `npm run test:intelligence`        |
| Queue, storage, approvals, model contracts | `npm run test:investigation`       |
| Console API                                | `npm run test:console:integration` |
| Console browser interactions               | `npm run test:console:browser`     |
| Orders API and REST BOLA journey           | `npm run test:assessment`          |
| Advisory triage and browser journey        | `npm run test:advisories`          |
| Lab category matrix, recovery, retention   | `npm run test:operations`          |

`test:example-target` is a shorter example-only check and is already included in `test:assessment`. Browser suites require local Google Chrome. Discovery requires native Linux ARM64 Docker support.

For gateway Python changes, also run:

```sh
npm run check:gateway -- format
npm run check:gateway -- style
npm run check:gateway -- unit
```

These checks use a network-disabled container after preparing pinned inputs. Discovery and operations runners accept a test name as an optional selector. Keep source unchanged while they run so their source-stability report remains meaningful.

## Manual check

After setup, run `npm run lab`, open the printed console URL, sign in, and start a public scan. Inspect inventory, try cancellation, and reload to check persistence. Stop with Ctrl+C. Use the [REST assessment walkthrough](bola-assessment.md) for a model-backed manual check; real Morph calls are separate from the local fixture suites and incur charges.
