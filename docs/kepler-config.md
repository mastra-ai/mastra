Here's the structure of the `kepler.config.ts` file:

## Framework Configuration

### Name

- `name`: string - The name of your Arkwright project.

### Database

Kepler needs a database to store the state of the system: authentication credentials and synced records. Right now we only support Postgres.

- `db`: object - Database configuration.
  - `provider`: 'postgres' - The database provider.
  - `uri`: string - The connection URI for your database.

When you deploy, we recommend setting `uri` to an environment variable so that you can have different values for production and development.

### Runner

Kepler uses Inngest to run background jobs, like refreshing credentials and syncing records.

- `runner`: object - The runner configuration.
  - `provider`: 'inngest' - The runner provider.
  - `uri`: string - The connection URI for your runner.

When you deploy, we recommend setting `uri` to an environment variable so that you can have different values for production and development.

### Other fields

- `systemHostURL` (optional): string - Kepler uses this when it's creating OAuth connection strings. Defaults to `process.env.APP_URL`.
- `routeRegistrationPath` (optional): string - Kepler puts a templated `route.js` folder in your app at this path that works with Next.js to handle. Defaults to `/api/kepler`.

### Integration Configuration

- `integrations`: Integration[] - An array of integration instances to be used in your project.

Integrations have to be individually installed, authenticated, and imported in the `kepler.config.ts` file. If you use the `admin` app, it will help you with the process.

The integration config object will vary depending on the authentication type of the integration:

- OAuth-based integrations will have `CLIENT_ID`, `CLIENT_SECRET`, and `SCOPES` as required fields.
- API key-based integrations will have `API_KEY` as a required field.
- Basic auth-based integrations will have `USERNAME` and `PASSWORD` as required fields.

Integrations can also define additional required or optional fields. Look at the package README for additional details.

### Workflow Configuration (optional)

Workflows consume events and trigger actions. Your system will define the events that can trigger workflows, and you can also consume events from external systems.

- `workflows`: object - Workflow configuration.
  - `systemEvents`: Record<string, SystemEvent> - An object defining events that happen in your app that you want to trigger workflows from.
  - `blueprintDirPath`: string - The directory path for storing blueprints (defaults to `/kepler-blueprints`).
  - `systemApis`: SystemApis[] - An array of system-level apis.
