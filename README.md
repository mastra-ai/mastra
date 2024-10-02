# Mastra Framework

Mastra helps you build 3rd party SaaS integrations into your Next.js App Router application.

There are three steps to integrating with third party services: _configuration_ (obtaining credentials), _authentication_ (connecting yourself or your users), and _interaction_ (choosing the appropriate API endpoints to call, data to sync, etc).

## Features

- **Type-safe API proxy**. Make authenticated calls to third-party services, with auto-completion and inline documentation in your IDE.
- **Interactive API playgrounds** for exploring and testing third-party services
- **User data sync**: Keep up-to-date user data from third-party services in your database

## Use Cases

- If you're building a CRM, you probably want to sync your users' Google Calendar events or email contacts.
- If you're building an e-commerce-related app, you probably want to sync your users' orders, inventory, or shipping information from Shopify.
- You can connect your _own_ SaaS services, for example, to pipe new user alerts into Slack, or to push customer product data into Salesforce.

## Getting Started

### Prerequisites

- Node.js (version 20 or later)
- pnpm (version 9.7.0 or later)
- Docker (if provisioning locally, the daemon should be running)

### Installation

1. Install the Mastra CLI:

   ```bash
   npm install -g @mastra/cli
   ```

2. Initialize your project:

   ```bash
   npx @mastra init
   ```

3. Follow the prompts to set up your database and other configurations.

### Configuration

After initialization, you'll find an `mastra.config.ts` file in your project root. This file contains the main configuration for your Mastra project. You can customize it according to your needs.

You can find the full list of configuration options in the [Mastra config docs](./docs/mastra-config.md).

### Installing Your First Integration

### Step 1: Connect through the admin panel

We recommend using the admin panel to set up your first integration. You can run admin panel locally by running `npx @mastra/cli dev` from the root of your project.

Note that to integrate with many SaaS platforms, in order to obtain API keys, you will need to set up a console app on their respective websites. We link to these docs from each integration's page in the admin panel.

The admin panel allows you to OAuth with the third-party service and obtain user credentials. It lets you explore actions, and play with the data returned from those actions.

_Note: If you want to explore the admin panel but don't have a specific service in mind, we recommend installing the Github integration, which can run on a personal access token._

### Step 2: Add the button to your app

The admin panel will provide you with a button component that you can add to your app, that will take users through an OAuth flow in the third-party service.

You'll want to connect a user now and verify that the OAuth flow works, and your users' data is successfully synced to your database.

### Step 3: Use the admin panel playground

Mastra integrations come with built-in sync: you can sync users' data from the third-party service to your production database.

The playground lets you get a feel for the shape of data coming from the third-party service, browse the library of API actions to call, and see the shape of data to feed into (and returned from) these actions.

### Step 4: Build an integration using the synced data

You'll now want to build your integration using the data synced to your database.

You can query the data cache using Mastra's `cache` API, and trigger actions in the third-party service using Mastra's `client` API.

### Step 5: Deploy to production

For production, you'll want to use a cloud-hosted Postgres database and a cloud-hosted Inngest account. (For Inngest, we've found [Inngest Cloud](https://inngest.com/cloud) to be reliable and performant.)

You'll need to make sure the `uri` values in your `mastra.config.ts` file are set to the correct environment variables, and that those values are set in your production environment.

### Syncing Data to Your App

Mastra uses [Inngest](https://inngest.com/) to run workflows. These workflows are defined as a series of events and actions that are triggered by the system or by your application. One of the most common workflows is syncing data from a third-party service to your application.

For example, you might want to sync your users' email contacts from Gmail. You can create a workflow that is triggered by a cron event (e.g. every 15 minutes) that syncs the data from Gmail to your application.

You can define these workflows in the `workflows` directory.

### Deploying to Production
