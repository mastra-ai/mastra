# Testing

Install dependencies with `npm install --workspaces=false`. Use the Node version in `.nvmrc`. Run commands from the template directory. Start with static and local checks:

```sh
npm run format
npm run typecheck
npm run check:console
npm run test:unit
npm run test:console:unit
```

`format` checks without writing. To format an edited file, use `npx oxfmt <path>`. Both TypeScript configurations reject unused locals and parameters.

## Integration suites

Run suites sequentially with the Docker daemon available and the normal listener stopped. They use temporary databases, project-owned targets, and local model/feed fixtures. They do not require `MORPH_API_KEY` or contact the real advisory feed. Use a clean shell without exported production credentials.

| Command                            | Coverage                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| `npm run test:integration`         | Runtime setup and Docker sandbox                                                    |
| `npm run test:control-plane`       | Real Hono API, sessions, CSRF, revisions, and sealed profiles                       |
| `npm run test:discovery`           | HTTP/headless inventory, interruption, and sanitized output                         |
| `npm run test:gateway`             | Scope, TLS, DNS, and network confinement                                            |
| `npm run test:intelligence`        | Offline catalog integrity, playbooks, and local advisory feed                       |
| `npm run test:investigation`       | Storage, queue, approvals, model-wire cases, and advisory fanout                    |
| `npm run test:console:integration` | Console API with persisted state                                                    |
| `npm run test:console:browser`     | Real Chrome console interactions                                                    |
| `npm run test:assessment`          | Orders API, REST BOLA admission/proof/lifecycle, and real Chrome assessment journey |
| `npm run test:advisories`          | Owner-isolated advisory triage, persistence, and real Chrome advisory journey       |
| `npm run test:operations`          | Eight-category lab matrix, crash/recovery, retention, and output audits             |

`test:unit` includes application/authentication/checker contracts, BOLA bindings, and source-digest coverage. `test:assessment` includes `test:example-target`; the latter remains available for a shorter example-only check. Run both new journey suites alongside the existing integration suites for a V1 regression. `test:intelligence` covers the local-feed sync CLI and material revision counters; `test:advisories` covers the operator-facing triage journey.

Browser tests launch a local Google Chrome installation through Playwright’s `chrome` channel. Discovery setup requires native Linux ARM64 Docker support. `test:operations` is the slowest suite and includes complete vulnerable/patched lab cases.

Run gateway Python checks separately:

```sh
npm run check:gateway -- format
npm run check:gateway -- style
npm run check:gateway -- unit
```

The validator prepares pinned inputs and runs in a network-disabled container. `format-write` is an explicit formatter, not a check. Discovery and operations runners accept a named test as an optional selector, enforce time/output bounds, and report cleanup and source stability. Keep the source unchanged while a runner is active.

## Manual smoke test

After `npm run setup`, configure local sign-in and discovery as described in [configuration](configuration.md). Run `npm run lab`, open the printed URL, sign in, and start a public scan. Inspect inventory and cancellation, reload to check persistence, then stop with Ctrl+C. Optional real Morph evaluation incurs charges and is separate from these fixture-based suites.
