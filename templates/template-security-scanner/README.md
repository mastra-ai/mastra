# Security Scanner

Security Scanner stores authorized website and API scopes, versioned policies, and isolated identity profiles behind a protected local API. Credentials are encrypted in local libSQL storage. It also prepares and checks the isolated Katana/Docker runtime. Scanning and remote identity requests remain disabled.

## Why we built this

Security testing needs a reproducible execution boundary before it can handle authorized targets or credentials. This runtime checks that boundary locally and records the image and resource settings used by its capability probe.

## Prerequisites

- **[Docker Desktop](https://docs.docker.com/desktop/)**: start a local Linux Docker daemon and make the Docker CLI available. The default socket is `/var/run/docker.sock`; set `DOCKER_SOCKET` if yours differs.
- Set `DOCKER_PLATFORM` to the daemon's native architecture: `linux/arm64` is the default, and `linux/amd64` is also selectable. Emulation is rejected. Platform support requires a successful local capability probe.
- The initial image build requires registry access to download the pinned Katana base. Images are built locally and are never published.
- Chromium must start with its browser sandbox enabled under the pinned runtime policy described below. Setup fails if the host cannot support that combination; it does not enable unsafe browser flags or extra capabilities.
- To manage targets and profiles, set `CONTROL_BOOTSTRAP_SECRET` to an independent random secret and `SCANNER_ENCRYPTION_KEY` to a 32-byte key encoded as 64 lowercase hex characters. Keep the key outside source control. A lost or replaced key requires credential re-registration. [Local API setup](CONTROL_PLANE.md) includes generation and usage commands.
- `CONTROL_SESSION_TTL_SECONDS` sets local session lifetime from 1 to 3600 seconds (default 1800). Sessions are discarded on restart. Without a bootstrap secret, only runtime diagnostics are exposed.
- No API key is required for these diagnostics or the local control plane. `EXPLORER_MODEL` and `JUDGE_MODEL` declare the intended Morph configuration without making a model request.

## Quickstart 🚀

1. **Open this template directory**
   - Use the Security Scanner directory in your checkout and run `npm install --workspaces=false` to install its dependencies independently of the parent workspace.
2. **Configure the local runtime**
   - Run `test -f .env || cp .env.example .env`, then edit the settings described under Prerequisites. Existing exported shell variables take precedence over `.env`.
3. **Set up the runtime**
   - Run `npm run setup`. It builds the local image, checks fixed harmless commands and offline browser startup, provisions a private test header file, initializes local storage, and awaits sandbox cleanup.
   - A successful run prints a sanitized receipt and saves `data/runtime-image.json` with the immutable local image ID, platform, image size, configured bounds, and observed memory usage. This memory observation is not a peak-memory benchmark.
4. **Open the local API**
   - Run `npm run dev`, then open [runtime diagnostics](http://127.0.0.1:4111/api/runtime). The response reports `control-plane` when a bootstrap secret is configured, or `diagnostics-only` otherwise, with scanning and native execution disabled. Follow the [local API example](CONTROL_PLANE.md#first-interaction) to create and retrieve a lab policy and target.
   - Stop the listener and workers with Ctrl+C.

## Try it out

- Run `npm run doctor` to check the configured drivers, selected runtime, and Docker daemon without creating an image, sandbox, or database.
- Run `npm run setup` again to repeat the capability checks. Set `DOCKER_RETAIN_SHARED_BASE_IMAGE=true` to retain the managed derived image between runs; otherwise it is removed after its final consumer exits. Images still in use by another container are preserved.
- Create a lab policy, target, and public profile using the [local API example](CONTROL_PLANE.md#first-interaction), restart the server, then retrieve their persisted metadata.
- Try an update with an old `If-Match` revision or without the session CSRF token. The API rejects the mutation and preserves the stored revision.
- Register a header or bearer profile through the protected API and retrieve it again. Responses include role and credential revision metadata without the credential value. Remote identity checks report `UNAVAILABLE`; scan requests never enqueue work.

## Customization

- Open the project in your coding agent and describe a focused change, such as: "Add a diagnostic for available Docker disk space. Explore the code and propose a plan before making changes."
- Adjust the finite memory, process, command-timeout, and retained-output settings in `.env.example` for your environment. The schema in `src/config/settings.ts` defines supported ranges and rejects unsupported drivers.

## Runtime operation

The sandbox has no network, no Linux capabilities, and `no-new-privileges`. It uses the pinned Moby seccomp profile v0.2.3 with one added allow rule for `clone`, `setns`, `unshare`, and `chroot`. This exposes those kernel calls beyond Docker's capability-conditioned defaults so Chromium can construct its own namespace sandbox without outer capabilities. The exact policy, source revision, integrity hashes, and Apache-2.0 license are included in `docker/discovery/`. Startup verifies the policy fingerprint applied by Docker and requires Chromium to report namespace isolation, PID/network namespaces, and seccomp-BPF active. Graphics acceleration and shader disk caching are disabled; no browser sandbox layer is disabled.

The nonroot user stages files in the owned ephemeral container layer; `/tmp` and `/dev/shm` have size-limited mounts. The root filesystem remains writable because the native file API extracts at the filesystem root. Staged files use the ordinary workspace directory because archive writes into a temporary filesystem mount can be invisible to container commands. The private-header provisioner uses the native container's archive API with explicit ownership and mode `0600`, then checks that the runtime user can read the file without printing its content.

Setup serializes image ownership with `data/setup.lock`. Cancellation waits for owned sandbox cleanup. A later setup removes abandoned probe containers belonging to this installation; it preserves unrelated containers and images. If a terminated process leaves the setup lock, inspect its recorded PID and confirm that process has stopped before removing that lock. Cleanup failures produce an actionable diagnostic and prevent a successful setup result. No command uses global Docker pruning.

The file-backed database and runtime receipt live under the private local `data/` directory. The diagnostic server initializes the official Mastra Hono adapter, starts workers after listening, and stops them on shutdown. Authenticated sessions can read allowlisted native agent, workflow, OpenAPI, and authentication-capability metadata. All native execution routes and scan dispatch remain blocked. Domain migrations use separate application-owned tables through the public libSQL client; Mastra retains its native runtime storage. See [local API operation](CONTROL_PLANE.md) for authorization, revisions, identity states, and key-loss behavior.

## About Mastra templates

This is an official Mastra template in development. Official templates live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are synchronized to standalone repositories.

[Want to contribute?](https://github.com/mastra-ai/mastra/blob/main/CONTRIBUTING.md)
