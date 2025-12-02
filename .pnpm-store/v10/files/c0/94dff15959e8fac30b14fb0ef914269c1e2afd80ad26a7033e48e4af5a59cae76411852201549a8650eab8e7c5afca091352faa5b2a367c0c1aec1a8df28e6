<div align="center">
  <br/>
    <a href="https://www.inngest.com"><img src="https://github.com/inngest/.github/raw/main/profile/github-readme-banner-2025-06-20.png"/></a>
  <br/>
  <br/>
  <p>
    Inngest is the reliability layer for modern applications. It combines durable execution, events, and queues into a zero-infra platform with built-in observability.
  </p>

**Works with:**
<br/>
<img src="https://jsr.io/logos/browsers.svg" height="20" />
<img src="https://jsr.io/logos/bun.svg" height="20" />
<img src="https://jsr.io/logos/deno.svg" height="20" />
<img src="https://jsr.io/logos/node.svg" height="20" />
<img src="https://jsr.io/logos/cloudflare-workers.svg" height="20" />

Read the <a href="https://www.inngest.com/docs?ref=github-inngest-js-readme">documentation</a> and get started in minutes.
<br/>

  <p>

<a href="https://www.npmjs.com/package/inngest"><img src="https://img.shields.io/npm/v/inngest" /></a>
<a href="https://jsr.io/@inngest/sdk"><img src="https://jsr.io/badges/@inngest/sdk" /></a>
<br/>
<a href="https://www.inngest.com/discord"><img src="https://img.shields.io/discord/842170679536517141?label=discord" /></a>
<a href="https://twitter.com/inngest"><img src="https://img.shields.io/twitter/follow/inngest?style=social" /></a>

  </p>
</div>

<hr />

On _any_ serverless platform ([Next.js](https://www.inngest.com/docs/sdk/serve#framework-next-js), [Deno Deploy](https://www.inngest.com/docs/sdk/serve#framework-fresh-deno), [RedwoodJS](https://www.inngest.com/docs/sdk/serve#framework-redwood), [AWS Lambda](https://www.inngest.com/docs/sdk/serve#framework-aws-lambda), and [anything else](https://www.inngest.com/docs/sdk/serve#custom-frameworks)) and with no extra infrastructure:

- ⚡ Write <b>background jobs</b>
- 🕐 Create <b>scheduled and cron jobs</b>
- ♻️ Build <b>serverless queues</b>
- 🪜 Write complex <b>step functions</b>
- 🚘 Build <b>serverless event-driven systems</b>
- 🪝 Reliably respond to webhooks, with retries and payloads stored for history

👋 _Have a question or feature request? [Join our Discord](https://www.inngest.com/discord)!_

<br />

<p align="center">
<a href="#getting-started">Getting started</a> ·
<a href="#features">Features</a> ·
<a href="#version-support">Version support</a> ·
<a href="#contributing">Contributing</a> ·
<a href="https://www.inngest.com/docs?ref=github-inngest-js-readme">Documentation</a>
</p>

<br />

## Getting started

<br />

Install Inngest:

```bash
npm install inngest
```

Or get it from [JSR](https://jsr.io/@inngest/sdk):

```bash
deno add jsr:@inngest/sdk
```

### Writing functions

Write serverless functions and background jobs right in your own code:

```ts
import { Inngest } from "inngest";

const inngest = new Inngest({ id: "my-app" });

// This function will be invoked by Inngest via HTTP any time
// the "app/user.signup" event is sent to to Inngest
export default inngest.createFunction(
  { id: "user-onboarding-communication" },
  { event: "app/user.signup" },
  async ({ event, step }) => {
    await step.run("Send welcome email", async () => {
      await sendEmail({
        email: event.data.email,
        template: "welcome",
      });
    });
  }
);
```

- Functions are triggered by events which can be sent via this SDK, webhooks, integrations, or with a simple HTTP request.
- When a matching event is received, Inngest invokes the function automatically, with built-in retries.

### Serving your functions

Inngest invokes functions via HTTP, so you need to _serve_ them using an adapter for the framework of your choice. [See all frameworks here in our docs](https://www.inngest.com/docs/sdk/serve?ref=github-inngest-js-readme). Here is an example using the Next.js serve handler:

```ts
// /pages/api/inngest.ts
import { Inngest } from "inngest";
// See the "inngest/next" adapter imported here:
import { serve } from "inngest/next";
import myFunction from "../userOnboardingCOmmunication"; // see above function

// You can create this in a single file and import where it's needed
const inngest = new Inngest({ id: "my-app" });

// Securely serve your Inngest functions for remote invocation:
export default serve(inngest, [myFunction]);
```

### Sending events to trigger functions

```ts
// Send events
import { Inngest } from "inngest";
const inngest = new Inngest({ id: "my-app" });

// This will run the function above automatically, in the background
inngest.send("app/user.signup", {
  data: { email: "text@example.com", user_id: "12345" },
});
```

- Events can trigger one or more functions automatically, enabling you to fan-out work.
- Inngest stores a history of all events for observability, testing, and replay.

<br />

## Features

- **Fully serverless:** Run background jobs, scheduled functions, and build event-driven systems without any servers, state, or setup
- **Works with your framework**: Works with [Next.js, Redwood, Express, Cloudflare Pages, Nuxt, Fresh (Deno), and Remix](https://www.inngest.com/docs/sdk/serve?ref=github-inngest-js-readme)
- **Deploy anywhere**: Keep [deploying to your existing platform](https://www.inngest.com/docs/deploy?ref=github-inngest-js-readme): Vercel, Netlify, Cloudflare, Deno, Digital Ocean, etc.
- **Use your existing code:** Write functions within your current project and repo
- **Fully typed**: Event schemas, versioning, and governance out of the box
- **Observable**: A full UI for managing and inspecting your functions

<br />

## Version support

The library works across browsers, Bun, Deno, Node, and Cloudflare Workers.

We support the LTS versions of these runtimes and the last 3 minor versions of
TypeScript; once a runtime version drops out of LTS, any major, minor, or patch
update to the `inngest` library may drop support for it, which will be mentioned
in the patch notes.

## Contributing

Check out [`CONTRIBUTING.md`](CONTRIBUTING.md) to get started.
