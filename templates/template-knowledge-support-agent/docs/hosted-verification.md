# Run hosted verification locally

The hosted verifier runs the production bundle against a temporary database and loopback services for identity and model responses. It supplies the test credentials and checks access, review recovery, and database restoration.

## Prerequisites

- Node.js and npm. Use a Node.js version listed in [package.json](../package.json).
- OpenSSL with support for `openssl req -addext`, used to generate a temporary TLS certificate.
- For LibSQL or Turso mode, install the `sqld` executable.
- For PostgreSQL or Neon mode, install the PostgreSQL binaries `initdb`, `pg_ctl`, `createdb`, `pg_dump`, and `pg_restore`.

The verifier looks for these binaries on `PATH` by default.

## Build and run

From the template directory in a local shell, install the dependencies, build the deployment bundle, and run the default LibSQL verification.

```sh
npm ci
npm run build
npm run test:hosted
```

Run an explicit provider configuration with one of these commands. Turso uses local `sqld`. PostgreSQL and Neon use a temporary local PostgreSQL cluster.

```sh
SUPPORT_TEST_PROVIDER=turso npm run test:hosted
SUPPORT_TEST_PROVIDER=postgres npm run test:hosted
SUPPORT_TEST_PROVIDER=neon npm run test:hosted
```

A successful run prints `Hosted proof passed` followed by the selected backend or provider.

## Environment variables

All of these variables are optional.

| Variable                | Purpose                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `SUPPORT_TEST_PROVIDER` | Exercise the named provider configuration. Use `turso`, `postgres`, or `neon`.             |
| `SUPPORT_TEST_BACKEND`  | Select `libsql` or `postgres` when `SUPPORT_TEST_PROVIDER` is unset. Defaults to `libsql`. |
| `SQLD_BIN`              | Path to the `sqld` executable.                                                             |
| `POSTGRES_BIN`          | Directory containing the PostgreSQL binaries.                                              |
| `OPENSSL_BIN`           | Path to the `openssl` executable.                                                          |
