# Security Scanner

Security Scanner maps explicitly authorized websites and APIs into a persisted inventory of endpoints, parameters, forms, and browser XHR requests. A protected local API manages target scopes and isolated public, header, bearer, or cookie profiles. Discovery uses a confined Katana/Chromium runtime and exports bounded, sanitized evidence with role and source provenance.

## Why we built this

A useful security inventory needs to show which identity observed a surface while respecting the operator's authorization and request limits. This project keeps that execution boundary outside model decisions and makes incomplete discovery, authentication failures, and removed evidence visible.

## Prerequisites

- **[Docker Desktop](https://docs.docker.com/desktop/)**: run a native Linux ARM64 daemon and make the Docker CLI available. Complete setup and discovery currently support `DOCKER_PLATFORM=linux/arm64`. Emulation and other discovery platforms fail closed. The default local socket is `/var/run/docker.sock`; use `DOCKER_SOCKET` if yours differs.
- Initial setup downloads pinned Katana/Chromium and mitmproxy images plus integrity-checked firewall and NSS inputs. Images are built locally and never published. After preparation, scan containers do not install dependencies or download reference content.
- Chromium must support the enabled namespace and seccomp sandbox. Setup rejects an unavailable browser sandbox instead of enabling unsafe flags or extra crawler capabilities.
- Set `CONTROL_BOOTSTRAP_SECRET` to an independent random secret and `SCANNER_ENCRYPTION_KEY` to a 32-byte key encoded as 64 lowercase hex characters. [Local API setup](CONTROL_PLANE.md) includes generation and session commands. Keep the key outside source control; a lost key requires credential re-registration.
- Discovery is disabled by default. `SCANNER_DISCOVERY_ENABLED=true` explicitly enables admission after successful setup; every request still requires current scope, profile and policy bindings. Use only targets you are authorized to assess. Non-lab targets require an operator-selected retention policy before admission.
- No model API key is required for setup, the control plane, or discovery. Investigation planning is separately opt-in with `SCANNER_INVESTIGATION_ENABLED=true` and a private `MORPH_API_KEY`; it can make paid Morph requests. Keep it disabled while configuring scopes and budgets.

## Quickstart 🚀

1. **Open the template directory**
   - In the Security Scanner directory from your checkout, run `npm install --workspaces=false`.
2. **Configure the local runtime**
   - Run `test -f .env || cp .env.example .env`, then fill in the operator settings under Prerequisites. Exported shell variables take precedence over `.env`.
3. **Prepare the runtime**
   - Run `npm run setup`. It verifies the native sandbox, initializes local storage, prepares pinned gateway/firewall/browser inputs, and removes owned temporary resources.
   - Setup saves private receipts under `data/`. A receipt describes prerequisites; it does not authorize a target or start a scan.
4. **Open the local API**
   - Run `npm run dev`, then open [runtime diagnostics](http://127.0.0.1:4111/api/runtime). Follow the [first API interaction](CONTROL_PLANE.md#first-interaction) to create and retrieve a policy, target, and public profile.
   - When discovery is explicitly enabled, follow [discovery operation](SCANNING.md) to admit an authorized target and retrieve its inventory. Stop the listener and active discovery with Ctrl+C.

## Try it out

- Run `npm run doctor` to inspect runtime prerequisites and whether discovery admission is enabled, without creating an image, sandbox, or database.
- Create a policy and authorized target through the local API, restart the server, and retrieve their persisted revisions.
- Run public HTTP discovery, then compare a header, bearer, or cookie profile against the same authorized origin. Inventory keeps each observation's role; credentials are never returned.
- Select headless discovery to collect browser XHR surfaces. Browser observations remain advertised surfaces without an upstream HTTP status claim. Discovery never submits forms or authorizes writes.
- Cancel a running scan or update its bound target. Inspect the persisted partial state, cleanup outcome, and evidence rather than assuming the interrupted run completed.
- Search the pinned offline references for a testing topic, then [manually sync the advisory inbox](INTELLIGENCE.md) and compare its stale status and material revision events across repeated imports.
- In the owned Docker lab, enable investigation planning, create a bounded investigation from a completed scan, and inspect hypotheses, jobs, proofs and findings. A per-target recurrence or newly published/materially revised advisory can replan from an existing completed scan and investigation precedent; a new discovery scan is still an explicit operation.

## Customization

- Open the project in your coding agent and describe a focused change, such as: "Add a new inventory view that groups sanitized endpoints by role. Explore the code and propose a plan before making changes."
- Adjust target scopes, finite budgets, explicit retention, and identity endpoints through the protected API. Use [discovery operation](SCANNING.md) when extending the driver or lab, and preserve the same authorization and confinement boundaries.

## Runtime operation

Crawler containers run as a nonroot user with no outer Linux capabilities, no host mounts or namespaces, no Docker socket, finite resources, disabled container logging, and `no-new-privileges`. The pinned Moby seccomp profile permits the four reviewed namespace setup calls so Chromium can construct its own sandbox. Chromium must report Namespace, PID/network namespaces, and Seccomp-BPF active. No browser sandbox layer or upstream TLS check is disabled.

Each profile has its own ephemeral sandbox, credential file and browser state. A transient NET_ADMIN-only helper installs and verifies default-drop namespace rules before the capability-free crawler starts. The crawler can reach only its exact gateway endpoint and narrow browser-local control ports. A capability-free gateway checks origin, authority, paths, methods, fresh DNS answers, numeric peer pins, TLS, and shared finite budgets before upstream contact. Private destinations are rejected; an owned fixture exception exists only inside the controlled integration laboratory.

Raw crawler output remains bounded and private in trusted memory, with native retained buffers disabled. Strict normalization and credential-aware minimization precede persistence and API export. Reflected unsafe fields are withheld and produce partial results. Some credential fragments can conflict with required metadata; admission then returns `CREDENTIAL_METADATA_CONFLICT` without dispatch. Cookie support does not imply every cookie string is accepted.

Local storage and receipts live under private `data/`. The configured `DATABASE_URL` file holds application-owned policy, target, discovery, advisory, and investigation state. Native Mastra storage uses a sibling file with `-mastra.db` in place of `.db`. Stop the server before backing up or restoring both files and their `-wal` and `-shm` sidecars. Setup and startup reject an existing single-file database with nonempty native SDK tables as `LEGACY_MASTRA_STATE`; they preserve those records and do not migrate them. Restore a compatible two-file backup or obtain a separately reviewed lossless migration before retrying.

One process owns the installation and one discovery runs at a time. Restart reconciles interrupted runs as failed and removes only recorded owned resources; it does not resume crawling or restore consumed budgets. Cleanup debt remains visible. Evidence expires only under the chosen retention policy, with persisted expiry counts and timestamps. Unrelated containers and shared-image consumers are preserved; no command uses global Docker pruning.

Investigation planning uses the configured Morph explorer and judge only when enabled. The owned Docker lab adapter supports bounded verification and approval-gated SSRF with a unique receiver for each approval; outside that boundary, verification fails closed. Due per-target recurrences and new/materially revised local advisories automatically plan against an existing completed scan and investigation precedent, with durable event identities across restarts. Advisory applicability stays unknown without verified software version evidence. Native execution routes remain blocked; authenticated sessions can read allowlisted native metadata through the official Mastra Hono adapter. See [local API operation](CONTROL_PLANE.md) and [discovery operation](SCANNING.md) for supported routes and outcomes.

The [offline reference catalog and advisory inbox](INTELLIGENCE.md) are available through the same protected API. Advisory synchronization is operator-initiated and remains visibly incomplete because it polls a bounded portion of the upstream feed each run.

## About Mastra templates

This is an official Mastra template in development. Official templates live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are synchronized to standalone repositories.

[Want to contribute?](https://github.com/mastra-ai/mastra/blob/main/CONTRIBUTING.md)
