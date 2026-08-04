![Circle Payment Agent](assets/header.png)

# Circle Payment Agent

An agent that owns a USDC wallet and pays for the services it calls. It searches the [Circle Agent Marketplace](https://agents.circle.com/services) for something that can answer your question, checks the price, waits for you to approve the spend, then settles per call without any API key or account signup. Built with [Mastra](https://mastra.ai) and the [Circle Agent Stack](https://developers.circle.com/agent-stack).

## Why we built this

Agents hit walls that have nothing to do with reasoning: a paywall, a missing API key, a rate limit. The usual fix is a human going off to sign up for something. This template removes that step. The agent holds funds and settles per call, so "I can't access that" turns into a purchase decision instead of a dead end.

It is also a practical use of Mastra primitives that are hard to show off with a read-only agent:

- **No tools, and no playbook.** There is no wrapper layer here — no typed tool per Circle command, and nothing in the prompt about how wallets, sellers or payments work. The agent is told where to find Circle's [setup document](https://agents.circle.com/skills/setup.md), and it does what that document says: fetches it, installs [Circle's skills](https://github.com/circlefin/skills), sets up the wallet, and pays for calls. Exactly the flow Circle documents for Claude Code and Codex, given the same starting prompt. What the prompt does carry is three rules for working a terminal — read the error, keep what you fetched, look at the whole list — the kind of thing an editor supplies and a bare agent has to be given.
- **Skills discovered from disk.** The agent installs skills into `~/.agents/skills`, the registry's tool-neutral store that `~/.claude/skills` and its equivalents symlink into, and Mastra's `skills` config reads that same directory. So the skills are installed once and shared with every other agent on the machine — and until the agent installs them, there are none.
- **A real terminal, gated on the irreversible.** A `Workspace` with a `LocalSandbox` gives the agent a shell, because that is what the skills are written for, and it runs what it likes there. What stops is what cannot be taken back: paying, transferring, bridging, signing, and raising the wallet's spending caps carry `requireApproval`, so Mastra suspends the run and Studio shows you the exact command before it executes. Everything else — installing, creating a wallet, reading balances, searching the marketplace, pricing a call with `--estimate` — just runs.
- **Reads of what the shell writes.** The same `Workspace` exposes `read_file` and `grep` over the host filesystem. A marketplace search is thousands of lines of JSON schema, more than any tool result can carry, so the agent does what a person does — redirects it to a file and goes back for the part it needs. Without a reader, going back means running the search again.

## Demo

![Discovering a service, approving the spend, and paying for the call](assets/demo.gif)

This demo runs in Mastra Studio, but you can connect this agent to your React, Next.js, or Vue app using the [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client) or agentic UI libraries like [AI SDK UI](https://mastra.ai/guides/build-your-ui/ai-sdk-ui), [CopilotKit](https://mastra.ai/guides/build-your-ui/copilotkit), or [Assistant UI](https://mastra.ai/guides/build-your-ui/assistant-ui).

## Prerequisites

- [Circle CLI](https://developers.circle.com/agent-stack/circle-cli/command-reference): `npm install -g @circle-fin/cli`
- A Circle account. You log in and accept Circle's Terms of Use yourself, in your own terminal, because an agent must never accept them for you.
- An [OpenAI API key](https://platform.openai.com/api-keys): used by default, but you can swap in any model

## Quickstart 🚀

1. **Clone the template**
   - Run `npx create-mastra@latest --template circle-payment-agent` to scaffold the project locally.
2. **Log in to Circle**
   - Run `circle wallet login`, then `circle wallet status` to confirm the session and accept the Terms of Use if you have not already.
3. **Add your API keys**
   - Copy `.env.example` to `.env` and fill in your keys.
4. **Start the dev server**
   - Run `npm run dev` and open [localhost:4111](http://localhost:4111) to try it out.

## Using it

Ask for what you want in plain language:

- `what services are available for weather data?`
- `check flight WN2417 with FlightAware`
- `top up my wallet with testnet USDC`
- `send 5 USDC on Base to 0x…`

On the first conversation the agent has no skills yet, so it fetches Circle's setup document and works through it — installing the skills, checking your session, creating a wallet. From then on the skills are on disk and it activates the one that fits.

The agent finds a candidate service, inspects its price, and picks a payment chain. When it is ready to spend, the run pauses: Studio shows the suspended command, and nothing is charged until you resume it. Decline and the agent goes looking for another way.

## Making it yours

There are only two files. Change the model in `src/mastra/agents/circle-payment-agent.ts` — any model Mastra can route to works — and change what stops for you in `src/mastra/approval.ts`, a short list of commands that move money or lift the caps on it. Everything not on that list runs unprompted, which is worth knowing before you extend it: the agent can delete files, install packages, and fetch from anywhere, and a marketplace response that talks it into one of those will not ask you first.

The real ceiling is not that file. Set per-transaction, daily, weekly, and monthly caps on the wallet itself with `circle wallet limit set` and they hold no matter what the agent is persuaded to do — that one is yours to run, since it confirms by one-time code. Keep the wallet funded with what you would not mind losing. The same wallet can also list a service of your own on the marketplace and collect per call; ask the agent about it and it will read Circle's `accept-agent-payments` skill.

## About Mastra templates

[Mastra templates](https://mastra.ai/templates) are ready-to-use projects that show off what you can build — clone one, poke around, and make it yours. They live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are automatically synced to standalone repositories for easier cloning.

Want to contribute? See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Attribution

The agent's instructions and every command it runs come from Circle's [skills](https://github.com/circlefin/skills) and [setup document](https://agents.circle.com/skills/setup.md), fetched and installed at runtime. This template contains no Circle code.
