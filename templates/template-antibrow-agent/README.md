# AntiBrow Agent

A web agent that browses through a persistent [AntiBrow](https://antibrow.com) profile, built on [Mastra](https://mastra.ai/).

## Why we built this

A browser tool that starts a fresh browser is fine for reading a public page and useless for anything behind a login: the session dies with the process, so the agent meets the sign-in page again on every run.

AntiBrow's unit of state is a *profile* rather than a session. The same profile name always gets back the same cookies, storage, engine-level fingerprint and proxy exit, so an agent that signed in yesterday is still signed in today. The browser runs on the machine the agent runs on, so there are no browser-hours to buy.

The template shows Mastra's tool composition around a single shared resource: four `createTool` definitions that all drive the same page through one session manager, so a read reads whatever the last navigation opened, plus `Memory` so the agent keeps the thread of a multi-step task.

## Features

- **Persistent identity**: cookies, storage and fingerprint survive between runs, per profile name
- **Web Navigation**: open a URL and get back the HTTP status, page title and final URL
- **Reading**: the visible text of the page or of one element, truncated so a page cannot fill the context window
- **Action Execution**: click elements and fill inputs by CSS selector
- **Session Management**: one browser shared by every tool, closed automatically after 10 idle minutes
- **Per-profile proxy**: set `ANTIBROW_PROXY` and the exit IP belongs to that profile, answered inside the browser engine

## Prerequisites

- [OpenAI API key](https://platform.openai.com/api-keys) — used by default, but you can swap in any model
- [AntiBrow API key](https://antibrow.com/dashboard) — the browser engine downloads on first launch and is cached

## Quickstart 🚀

1. **Clone the template**
   - Run `npx create-mastra@latest --template antibrow-agent` to scaffold the project locally.
2. **Add your API keys**
   - Copy `.env.example` to `.env` and fill in your keys. `ANTIBROW_PROFILE` names the identity; `ANTIBROW_PROXY` is optional.
3. **Start the dev server**
   - Run `npm run dev` and open [localhost:4111](http://localhost:4111) to try it out.

## Making it yours

Open Studio and select the "Web Assistant" agent.

Two agents that must not share an identity need two profile names, not two tabs: change `ANTIBROW_PROFILE`, or pass a name per session manager. The instructions tell the model to check whether it is already signed in before asking for credentials — that is the behaviour a persistent profile buys, and it is worth keeping if you rewrite them.

A persistent identity removes the tells that come from starting over every run: a fresh profile, a stock automation fingerprint, your own IP. It does not promise that a given site will accept an automated session.

## About Mastra templates

[Mastra templates](https://mastra.ai/templates) are ready-to-use projects that show off what you can build — clone one, poke around, and make it yours. They live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are automatically synced to standalone repositories for easier cloning.

Want to contribute? See [CONTRIBUTING.md](https://github.com/mastra-ai/mastra/blob/main/templates/template-antibrow-agent/CONTRIBUTING.md).
