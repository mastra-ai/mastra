# @mastra/react

`@mastra/react` provides React context, hooks, and UI helpers for applications that connect to a Mastra server. Wrap your application with `MastraReactProvider` once, then use the package's agent, workflow, voice, and message APIs throughout the component tree.

## Installation

```bash
npm install @mastra/react
```

## Usage

Render the provider near the root of your React application.

```tsx
import { MastraReactProvider } from '@mastra/react';

export function App({ children }: { children: React.ReactNode }) {
  return <MastraReactProvider baseUrl="http://localhost:4111">{children}</MastraReactProvider>;
}
```

## Documentation

- [@mastra/react documentation](https://mastra.ai/docs/server/mastra-client)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/client-sdks/react/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
