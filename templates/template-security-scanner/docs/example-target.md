# Orders API example

The example provides two accounts, private orders, and public products for testing REST discovery and BOLA assessments.

Start it with `npm run example-target`. Its terminal prints two API keys and these URLs:

| Output           | Use                                                           |
| ---------------- | ------------------------------------------------------------- |
| `scannerUrl`     | Scanner origin; append `/api/orders` for the target entry URL |
| `openApiUrl`     | OpenAPI URL in the scanner                                    |
| `hostUrl`        | Loopback URL for your own HTTP client                         |
| `hostOpenApiUrl` | OpenAPI URL for your own HTTP client                          |

Keep the terminal output private. Send API keys in the `x-api-key` header. Start the example before `npm run dev` so the scanner can validate its local Docker connection. Follow [Assess the Orders API](bola-assessment.md) for console setup.

## Routes and modes

| GET route                  | Behavior                                                                            |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `/api/orders`              | Returns the caller's account ID and links to their orders                           |
| `/api/orders/{id}`         | Allows cross-account reads in vulnerable mode; enforces ownership in protected mode |
| `/api/orders/{id}/receipt` | Enforces ownership in both modes                                                    |
| `/api/products`            | Public, with the same response for every account                                    |
| `/openapi.json`            | Public API description without keys or private order data                           |

The default mode is vulnerable. To compare protected behavior, stop the example and scanner, run `npm run example-target -- --mode=protected`, then restart `npm run dev`. Register the target with the new printed URLs and check its profiles again.

Keys, users, and orders persist under ignored `data/example-target/`. To rotate keys and reseed, stop the example and remove only that directory. For smaller changes, edit [the server](../example-target-api/server.ts) or [seed data](../example-target-api/store.ts), then run `npm run test:example-target`.

The launcher builds and cleans up its own Docker resources. After a crash, launch it again to reconcile saved resources. A second concurrent instance is rejected. Don't use global Docker pruning.

## Use a public HTTPS URL

To exercise the scanner's public-network path, expose the running example through an HTTPS tunnel with HTTP inspection disabled:

```sh
ngrok http --inspect=false 127.0.0.1:<hostUrl-port>
```

Use the tunnel origin with `/api/orders` as the entry path and `/openapi.json` as the OpenAPI path. Allow both `/api` and `/openapi.json` in the target scope. Select staging, confirm authorization, and set retention and request limits. Stop the tunnel when finished. This exposes the same local example; it doesn't create a separate staging deployment.
