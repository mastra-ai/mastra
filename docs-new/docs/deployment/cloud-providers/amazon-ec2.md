---
title: 'Amazon EC2'
description: 'Deploy your Mastra applications to Amazon EC2.'
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Amazon EC2

Deploy your Mastra applications to Amazon EC2 (Elastic Cloud Compute).

:::note

This guide assumes your Mastra application has been created using the default
`npx create-mastra@latest` command.
For more information on how to create a new Mastra application,
refer to our [getting started guide](/docs/getting-started/installation)

:::

## Prerequisites

- An AWS account with [EC2](https://aws.amazon.com/ec2/) access
- An EC2 instance running Ubuntu 24+ or Amazon Linux
- A domain name with an A record pointing to your instance
- A reverse proxy configured (e.g., using [nginx](https://nginx.org/))
- SSL certificate configured (e.g., using [Let's Encrypt](https://letsencrypt.org/))
- Node.js 18+ installed on your instance

## Deployment Steps

### Clone your Mastra application

Connect to your EC2 instance and clone your repository:

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

## Connect to your Mastra server

You can now connect to your Mastra server from your client application using a `MastraClient` from the `@mastra/client-js` package.

Refer to the [`MastraClient` documentation](/docs/server-db/mastra-client) for more information.

```typescript copy showLineNumbers
import { MastraClient } from '@mastra/client-js';

const mastraClient = new MastraClient({
  baseUrl: 'https://<your-domain-name>',
});
```

## Next steps

- [Mastra Client SDK](/docs/server-db/mastra-client)
