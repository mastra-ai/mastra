---
title: "Digital Ocean"
description: "Deploy your Mastra applications to Digital Ocean."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Digital Ocean

Deploy your Mastra applications to Digital Ocean's App Platform and Droplets.

:::note

  This guide assumes your Mastra application has been created using the default
  `npx create-mastra@latest` command.
  For more information on how to create a new Mastra application,
  refer to our [getting started guide](./../../getting-started/installation.md)

:::

<Tabs>

<TabItem value="app-platform" label="App Platform">

## App Platform

### Prerequisites [#app-platform-prerequisites]

- A Git repository containing your Mastra application. This can be a [GitHub](https://github.com/) repository, [GitLab](https://gitlab.com/) repository, or any other compatible source provider.
- A [Digital Ocean account](https://www.digitalocean.com/)

### Deployment Steps



### Create a new App

- Log in to your [Digital Ocean dashboard](https://cloud.digitalocean.com/).
- Navigate to the [App Platform](https://docs.digitalocean.com/products/app-platform/) service.
- Select your source provider and create a new app.

### Configure Deployment Source

- Connect and select your repository. You may also choose a container image or a sample app.
- Select the branch you want to deploy from.
- Configure the source directory if necessary. If your Mastra application uses the default directory structure, no action is required here.
- Head to the next step.

### Configure Resource Settings and Environment Variables

- A Node.js build should be detected automatically.
- **Configure Build Command**: You need to add a custom build command for the app platform to build your Mastra project successfully. Set the build command based on your package manager:

<Tabs>
  <TabItem value="build" label="build">
    ```
    npm run build
    ```
  </TabItem>
  <TabItem value="build" label="build">
    ```
    pnpm build
    ```
  </TabItem>
  <TabItem value="build" label="build">
    ```
    yarn build
    ```
  </TabItem>
  <TabItem value="build" label="build">
    ```
    bun run build
    ```
  </TabItem>
</Tabs>

- Add any required environment variables for your Mastra application. This includes API keys, database URLs, and other configuration values.
- You may choose to configure the size of your resource here.
- Other things you may optionally configure include, the region of your resource, the unique app name, and what project the resource belongs to.
- Once you're done, you may create the app after reviewing your configuration and pricing estimates.

### Deployment

- Your app will be built and deployed automatically.
- Digital Ocean will provide you with a URL to access your deployed application.



You can now access your deployed application at the URL provided by Digital Ocean.

:::note

The Digital Ocean App Platform uses an ephemeral file system,
meaning that any files written to the file system are short-lived and may be lost.
Avoid using a Mastra storage provider that uses the file system,
such as `LibSQLStore` with a file URL.

:::

</TabItem>

<TabItem value="droplets" label="Droplets">

## Droplets

Deploy your Mastra application to Digital Ocean's Droplets.

### Prerequisites [#droplets-prerequisites]

- A [Digital Ocean account](https://www.digitalocean.com/)
- A [Droplet](https://docs.digitalocean.com/products/droplets/) running Ubuntu 24+
- A domain name with an A record pointing to your droplet
- A reverse proxy configured (e.g., using [nginx](https://nginx.org/))
- SSL certificate configured (e.g., using [Let's Encrypt](https://letsencrypt.org/))
- Node.js 18+ installed on your droplet

### Deployment Steps



### Clone your Mastra application

Connect to your Droplet and clone your repository:

<Tabs>
<TabItem value="tab-1" label="Tab 1">

```bash copy
git clone https://github.com/<your-username>/<your-repository>.git
```

</TabItem>

<TabItem value="tab-2" label="Tab 2">

```bash copy
git clone https://<your-username>:<your-personal-access-token>@github.com/<your-username>/<your-repository>.git
```

</TabItem>
</Tabs>

Navigate to the repository directory:

```bash copy
cd "<your-repository>"
```

### Install dependencies

```bash copy
npm install
```

### Set up environment variables

Create a `.env` file and add your environment variables:

```bash copy
touch .env
```

Edit the `.env` file and add your environment variables:

```bash copy
OPENAI_API_KEY=<your-openai-api-key>
# Add other required environment variables
```

### Build the application

```bash copy
npm run build
```

### Run the application

```bash copy
node --import=./.mastra/output/instrumentation.mjs --env-file=".env" .mastra/output/index.mjs
```

:::note

Your Mastra application will run on port 4111 by default. Ensure your reverse proxy is configured to forward requests to this port.

:::



</TabItem>

</Tabs>

## Connect to your Mastra server

You can now connect to your Mastra server from your client application using a `MastraClient` from the `@mastra/client-js` package.

Refer to the [`MastraClient` documentation](/docs/server-db/mastra-client) for more information.

```typescript copy showLineNumbers
import { MastraClient } from "@mastra/client-js";

const mastraClient = new MastraClient({
  baseUrl: "https://<your-domain-name>",
});
```

## Next steps

- [Mastra Client SDK](/docs/client-js/overview)
- [Digital Ocean App Platform documentation](https://docs.digitalocean.com/products/app-platform/)
- [Digital Ocean Droplets documentation](https://docs.digitalocean.com/products/droplets/)
