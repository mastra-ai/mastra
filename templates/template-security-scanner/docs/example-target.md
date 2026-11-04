# Local example Orders API

Run the project-owned example in one terminal after the template's normal npm installation:

```sh
npm run example-target
```

The command prints the exact host URL, scanner URL, OpenAPI URLs, route paths, two user IDs, and two independent API keys to that terminal. Keep the terminal output private. Use the printed `scannerUrl` and `openApiUrl` when registering the authorized local target in the scanner. The `hostUrl` is bound to `127.0.0.1` for local HTTP clients. Send each key in the `x-api-key` header.

The example serves `GET /api/orders`, `GET /api/orders/{id}`, `GET /api/orders/{id}/receipt`, `GET /api/products`, and `GET /openapi.json`. The order collection returns only the caller's references. The order detail route deliberately allows user B to read an A-owned order in the default `vulnerable` mode. The receipt route requires ownership in both modes, providing another read-only surface with a detail-link prerequisite. Products are identical for both users and anonymous clients. OpenAPI is public and contains no API keys, user IDs, or seeded private order values.

For the negative control, stop the example with Ctrl-C and restart the same data in protected mode:

```sh
npm run example-target -- --mode=protected
```

The same cross-user order detail request then returns `403`; own-order reads and public products still work. The SQLite database and private seed are retained under ignored `data/example-target/`. Keys and user IDs stay stable across restarts. To rotate both example keys and reseed the example, stop the process and explicitly remove only `data/example-target/` before starting it again.

The target container attaches only to a project-owned internal Docker network. A separate fixed-purpose relay publishes one loopback port and forwards TCP to that target. The launcher builds its image locally, verifies the resource labels and network, and writes a mode-0600 handoff receipt. A concurrent `npm run dev` revalidates that receipt before accepting the example's private address as an owned lab destination. Stopping the launcher removes its own containers, networks, and image without global Docker cleanup. The scanner's normal authorization, gateway, and budget checks remain required for any scan.

The launcher holds a project-specific loopback TCP listener as an exclusive instance guard until cleanup finishes. A second launch fails while the first is active. If the launcher crashes, the operating system releases the guard; the next launch checks the old receipt and cleans only its verified resources before restarting.

The Docker build uses an immutable Node base digest and `npm ci` with an exact dependency lock retained only under ignored `data/example-target/build-evidence/`. The lock and local provenance hashes are not a tracked template lockfile. Keep this directory when you want to reproduce the same image dependencies across example restarts; remove it only when deliberately regenerating the local build inputs.

## Public HTTPS transport check

To check the separate public URL path, you can temporarily expose the local Hono example through a public HTTPS tunnel. Keep `npm run example-target` running, read the port from its printed `hostUrl`, and start one tunnel with HTTP inspection disabled:

```sh
ngrok http --inspect=false 127.0.0.1:<hostUrl-port>
```

Use the tunnel's HTTPS origin for the scanner target, with `/api/orders` as the entry path and `/openapi.json` as the OpenAPI path. Classify it as staging, record authorization, and set retention and read budgets. The tunnel is a public route to the **same locally hosted Hono container**; it is not independently hosted staging infrastructure. Keep the two printed API keys private, and stop the tunnel when the check ends. The scanner's external path does not use the example's Docker labels, private network allowance, or relay marker.

The current REST reader uses fixed Katana requests through the inspected sandbox and gateway. It accepts only confirmed GET routes, validates the gateway's upstream marker, and keeps bounded raw response bytes in trusted memory until it can export only path, method, status, profile and route-template metadata. It does not retain raw JSON bodies, headers or keys. See [REST execution](rest-api-execution.md) for registration and unsupported cases.
