---
title: "Using with CopilotKit"
description: "Learn how Mastra leverages the CopilotKit's AGUI library and how you can leverage it to build user experiences"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Integrate CopilotKit with Mastra

CopilotKit provides React components to quickly integrate customizable AI copilots into your application. Combined with Mastra, you can build sophisticated AI apps featuring bidirectional state synchronization and interactive UIs.

Visit the [CopilotKit documentation](https://docs.copilotkit.ai/) to learn more about CopilotKit concepts, components, and advanced usage patterns.

This guide shows two distinct integration approaches:

1. Integrate CopilotKit in your Mastra server with a separate React frontend.
2. Integrate CopilotKit in your Next.js app

<Tabs>
  <TabItem value="mastra-server" label="Mastra Server" default>

  
## Install React Dependencies

In your React frontend, install the required CopilotKit packages:

<Tabs groupId="package-manager">
  <TabItem value="npm" label="npm" default>
    ```bash copy
    npm install @copilotkit/react-core @copilotkit/react-ui
    ```
  </TabItem>
  <TabItem value="yarn" label="yarn">
    ```bash copy
    yarn add @copilotkit/react-core @copilotkit/react-ui
    ```
  </TabItem>
  <TabItem value="pnpm" label="pnpm">
    ```bash copy
    pnpm add @copilotkit/react-core @copilotkit/react-ui
    ```
  </TabItem>
</Tabs>

## Create CopilotKit Component

Create a CopilotKit component in your React frontend:

```tsx filename="components/copilotkit-component.tsx" showLineNumbers copy
import { CopilotChat } from "@copilotkit/react-ui";
import { CopilotKit } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";

export function CopilotKitComponent({ runtimeUrl }: { runtimeUrl: string}) {
  return (
    <CopilotKit
      runtimeUrl={runtimeUrl}
      agent="weatherAgent"
    >
      <CopilotChat
        labels={{
          title: "Your Assistant",
          initial: "Hi! 👋 How can I assist you today?",
        }}
      />
    </CopilotKit>
  );
}
```

## Install Dependencies

If you have not yet set up your Mastra server, follow the [getting started guide](/docs/getting-started/installation) to set up a new Mastra project.

In your Mastra server, install additional packages for CopilotKit integration:

<Tabs groupId="package-manager">
  <TabItem value="npm" label="npm" default>
    ```bash copy
    npm install @copilotkit/runtime @ag-ui/mastra
    ```
  </TabItem>
  <TabItem value="yarn" label="yarn">
    ```bash copy
    yarn add @copilotkit/runtime @ag-ui/mastra
    ```
  </TabItem>
  <TabItem value="pnpm" label="pnpm">
    ```bash copy
    pnpm add @copilotkit/runtime @ag-ui/mastra
    ```
  </TabItem>
</Tabs>

## Configure Mastra Server

Configure your Mastra instance to include CopilotKit's runtime endpoint:

```typescript filename="src/mastra/index.ts" showLineNumbers copy {5-8,12-28}
import { Mastra } from "@mastra/core/mastra";
import { registerCopilotKit } from "@ag-ui/mastra";
import { weatherAgent } from "./agents/weather-agent";

type WeatherRuntimeContext = {
  "user-id": string;
  "temperature-scale": "celsius" | "fahrenheit";
};

export const mastra = new Mastra({
  agents: { weatherAgent },
  server: {
    cors: {
      origin: "*",
      allowMethods: ["*"],
      allowHeaders: ["*"]
    },
    apiRoutes: [
      registerCopilotKit<WeatherRuntimeContext>({
        path: "/copilotkit",
        resourceId: "weatherAgent",
        setContext: (c, runtimeContext) => {
          runtimeContext.set("user-id", c.req.header("X-User-ID") || "anonymous");
          runtimeContext.set("temperature-scale", "celsius");
        }
      })
    ]
  }
});
```

## Usage in your React App

Use the component in your React app with your Mastra server URL:

```tsx filename="App.tsx" showLineNumbers copy {5}
import { CopilotKitComponent } from "./components/copilotkit-component";

function App() {
  return (
    <CopilotKitComponent runtimeUrl="http://localhost:4111/copilotkit" />
  );
}

export default App;
```

  
  </TabItem>

  <TabItem value="nextjs" label="Next.js">


  ## Install Dependencies

In your Next.js app, install the required packages:

<Tabs groupId="package-manager">
  <TabItem value="npm" label="npm" default>
    ```bash copy
    npm install @copilotkit/react-core @copilotkit/react-ui @copilotkit/runtime @ag-ui/mastra
    ```
  </TabItem>
  <TabItem value="yarn" label="yarn">
    ```bash copy
    yarn add @copilotkit/react-core @copilotkit/react-ui @copilotkit/runtime @ag-ui/mastra
    ```
  </TabItem>
  <TabItem value="pnpm" label="pnpm">
    ```bash copy
    pnpm add @copilotkit/react-core @copilotkit/react-ui @copilotkit/runtime @ag-ui/mastra
    ```
  </TabItem>
</Tabs>

## Create CopilotKit Component [#full-stack-nextjs-create-copilotkit-component]

Create a CopilotKit component:

```tsx filename="components/copilotkit-component.tsx" showLineNumbers copy
'use client';
import { CopilotChat } from "@copilotkit/react-ui";
import { CopilotKit } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";

export function CopilotKitComponent({ runtimeUrl }: { runtimeUrl: string}) {
  return (
    <CopilotKit
      runtimeUrl={runtimeUrl}
      agent="weatherAgent"
    >
      <CopilotChat
        labels={{
          title: "Your Assistant",
          initial: "Hi! 👋 How can I assist you today?",
        }}
      />
    </CopilotKit>
  );
}
```

## Create API Route

There are two approaches for the API route determined by how you're integrating Mastra in your Next.js application.

1. For a full-stack Next.js app with an instance of Mastra integrated into the app.
2. For a Next.js app with a separate Mastra server and the Mastra Client SDK.

<Tabs>
<TabItem value="local-mastra" label="Local Mastra Agents" default>

Create an API route that connects to local Mastra agents.

```typescript filename="app/api/copilotkit/route.ts" showLineNumbers copy {1-7,11-26}
import { mastra } from "../../mastra";
import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { MastraAgent } from "@ag-ui/mastra";
import { NextRequest } from "next/server";

export const POST = async (req: NextRequest) => {
  const mastraAgents = MastraAgent.getLocalAgents({
    mastra,
    agentId: "weatherAgent",
  });

  const runtime = new CopilotRuntime({
    agents: mastraAgents,
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter: new ExperimentalEmptyAdapter(),
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
```

</TabItem>
<TabItem value="remote-mastra" label="Remote Mastra (Client SDK)">

## Install the Mastra Client SDK

Install the Mastra Client SDK.

<Tabs groupId="package-manager">
  <TabItem value="npm" label="npm" default>
    ```bash copy
    npm install @mastra/client-js
    ```
  </TabItem>
  <TabItem value="yarn" label="yarn">
    ```bash copy
    yarn add @mastra/client-js
    ```
  </TabItem>
  <TabItem value="pnpm" label="pnpm">
    ```bash copy
     pnpm add @mastra/client-js
    ```
  </TabItem>
</Tabs>

Create an API route that connects to remote Mastra agents:

```typescript filename="app/api/copilotkit/route.ts" showLineNumbers copy {1-7,12-26}
import { MastraClient } from "@mastra/client-js";
import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { MastraAgent } from "@ag-ui/mastra";
import { NextRequest } from "next/server";

export const POST = async (req: NextRequest) => {
  const baseUrl = process.env.MASTRA_BASE_URL || "http://localhost:4111";
  const mastraClient = new MastraClient({ baseUrl });

  const mastraAgents = await MastraAgent.getRemoteAgents({ mastraClient });

  const runtime = new CopilotRuntime({
    agents: mastraAgents,
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter: new ExperimentalEmptyAdapter(),
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
```

      </TabItem>
    </Tabs>

## Use Component

Use the component with the local API endpoint:

```tsx filename="App.tsx" showLineNumbers copy {5}
import { CopilotKitComponent } from "./components/copilotkit-component";

function App() {
  return (
    <CopilotKitComponent runtimeUrl="/api/copilotkit" />
  );
}

export default App;
```

  
  </TabItem>
</Tabs>

Start building the future!

<br />

![CopilotKit output](/img/copilotkit/cpkoutput.jpg)

## Next Steps

- [CopilotKit Documentation](https://docs.copilotkit.ai) - Complete CopilotKit reference
- [React Hooks with CopilotKit](https://docs.copilotkit.ai/reference/hooks/useCoAgent) - Advanced React integration patterns
- [Next.js Integration with Mastra](/docs/frameworks/web-frameworks/next-js) - Full-stack Next.js setup guide
