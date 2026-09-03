![Circle Payment Agent](assets/header.png)

# Circle Payment Agent

An AI agent with its own USDC wallet that discovers and pays for services on demand. It uses the [Circle Agent Stack](https://developers.circle.com/agent-stack) to search the [Circle Agent Marketplace](https://agents.circle.com/services), estimate the cost, request approval, and pay per call—without subscriptions, API keys, or account signups. Built with [Mastra](https://mastra.ai).

## Why we built this

Agents often stop at paywalls, missing API keys, and account setup. This template turns those blockers into on-demand purchases: the agent can discover a service, price the request, and pay with USDC when you approve it.

- **Agent-native setup.** The agent follows Circle's [setup document](https://agents.circle.com/skills/setup.md), installs [Circle Skills](https://github.com/circlefin/skills), and uses them directly from its terminal.
- **Approval at the point of spend.** Mastra runs discovery, pricing, and balance checks automatically, but suspends commands that pay, transfer, bridge, or sign so you can review them first.
- **Wallet-level guardrails.** Circle wallet spending policies enforce transaction and time-based limits independently of the agent.



## Demo

This demo runs in Mastra Studio, but you can connect this agent to your React, Next.js, or Vue app using the [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client) or agentic UI libraries like [AI SDK UI](https://mastra.ai/guides/build-your-ui/ai-sdk-ui), [CopilotKit](https://mastra.ai/guides/build-your-ui/copilotkit), or [Assistant UI](https://mastra.ai/guides/build-your-ui/assistant-ui).

## Prerequisites

- [Circle CLI](https://developers.circle.com/agent-stack/circle-cli/command-reference): `pnpm add -g @circle-fin/cli`
- An [OpenAI API key](https://platform.openai.com/api-keys): used by default, but you can swap in any model



## Quickstart 🚀

1. **Clone the template**
  - Run `pnpm create mastra@latest --template circle-payment-agent` to scaffold the project locally.
2. **Log in to Circle**
  - Run `circle wallet login`, then `circle wallet status` to confirm the session and accept the Terms of Use if you have not already.
3. **Add your API keys**
  - Copy `.env.example` to `.env` and fill in your keys.
  - If your corporate network inspects TLS traffic, uncomment `NODE_OPTIONS=--use-system-ca`. This setting requires Node.js 22.15 or later.
4. **Start the dev server**
  - Run `pnpm dev` and open [localhost:4111](http://localhost:4111) to try it out.



## Using it

Ask for what you want in plain language:

- `what services are available for weather data?`
- `check flight WN2417 with FlightAware`
- `top up my wallet with testnet USDC using a credit card`
- `send 5 USDC on Base to 0x…`

On the first conversation the agent has no skills yet, so it fetches Circle's setup document and works through it — installing the skills, checking your session, creating a wallet. From then on the skills are on disk and it activates the one that fits.

The agent finds a candidate service, inspects its price, and picks a payment chain. When it is ready to spend, the run pauses: Studio shows the suspended command, and nothing is charged until you resume it. Decline and the agent goes looking for another way.

## Making it yours

There are four files, and two of them you can expect to delete. Change the model with `AGENT_MODEL` in `.env` — any model Mastra can route to works, so long as you supply that provider's API key — and change what stops for you in `src/mastra/approval.ts`, which holds three short lists: the commands that spend, which wait for your approval; the ones you have to run yourself, which the agent is refused; and the one install that would write the skills where this agent never reads them. Everything on neither list runs unprompted, which is worth knowing before you extend it: the agent can delete files, install packages, and fetch from anywhere, and a marketplace response that talks it into one of those will not ask you first.

The other two files are stopgaps, each with its reason at the top and an expiry date. `src/mastra/circle-docs.ts` answers a fetch of one of Circle's documents with the document itself, because command output reaches the model as its last 200 lines — the right shape for a log, the wrong one for a setup guide that puts the install instruction near the top. `src/mastra/skill-source.ts` shortens a skill description that runs over Mastra's 1024-character limit, because a skill over the limit is not trimmed but rejected, and Circle's `pay-via-agent-wallet` — the one that explains how to pay — is 1128 characters. A third sits in the agent file: an `afterToolCall` hook that rebuilds the skill catalogue as soon as an install lands, rather than leaving the agent to call a skill that is on disk but not yet in the catalogue. All three are narrow, none of them changes what the agent is told, and each becomes dead code once the matching limit moves in `@mastra/core`.

The real ceiling is not `approval.ts`. Set per-transaction, daily, weekly, and monthly caps on the wallet itself with `circle wallet limit set` and they hold no matter what the agent is persuaded to do — that one is yours to run, since it confirms by one-time code. Keep the wallet funded with what you would not mind losing. The same wallet can also list a service of your own on the marketplace and collect per call; ask the agent about it and it will read Circle's `accept-agent-payments` skill.

## One caller, one workspace

Every request names the caller it belongs to, in the `user-id` it sends in
`requestContext`, and that name is the only thing that decides which home
directory the shell opens in — its own CLI config, its own login, its own files.
A request that names nobody is refused rather than pooled somewhere shared.

There is no setting for this and no way to turn it off. The alternative is one
home directory and one logged-in session for everyone who can reach the URL,
which means the first visitor's wallet pays for the rest; a switch for that is a
switch for handing a stranger your money, so there isn't one. Homes live under
`~/.circle-agent/tenants/<user-id>` (`/tmp` if that is not writable, as in some
containers) and survive a restart. See `src/mastra/tenancy.ts`.

One caller cannot name itself. Mastra Studio is a console for whatever agent it
is pointed at rather than a front end with users of its own, so it sends no
`user-id` and every request it makes would be refused — the agent listed and
unusable. `src/mastra/studio.ts` names it `studio` in middleware, and only when
a request carrying no id arrives from Studio's own page: the deployment's
`*.studio.mastra.cloud` subdomain, or the Studio this server hosts itself. A
request that already names a caller is untouched, and everything else is refused
exactly as before. `Origin` is a header the caller writes, so this is a
convenience and not a boundary — cap the wallet with `circle wallet limit set`
on anything strangers can reach.

That caller also signs in differently. It has no terminal to paste a command
into and no proxy in front of it calling the control plane, so it gets two tools
instead: one that puts Circle's Terms to you as an approval, and one that takes
your email, has Circle send the code, and suspends for you to type it — the same
pause Studio already shows before a spend. Neither is something the agent can
finish alone, and the code goes from the resume payload to the CLI without
entering the model's context or the thread. Every other caller signs in through
the front end calling `/circle/*`. See `src/mastra/login-tool.ts`.

The cost is local convenience. The agent does not see the Circle session in your
own `~/.circle-cli`, because that is not the home it opens — so you log in once
per username, and the agent hands you the command with the right `HOME=` prefix
when it needs you to. Logging in without that prefix writes to your own home,
where the agent will never find it.

This is one half of a pair. Nothing here checks that a caller is who it says it
is, so put something in front that authenticates and sets the id. Without that,
`user-id` is a field anyone can type, and picking someone else's is all it takes
to reach their wallet.

## About Mastra templates

[Mastra templates](https://mastra.ai/templates) are ready-to-use projects that show off what you can build — clone one, poke around, and make it yours. They live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are automatically synced to standalone repositories for easier cloning.

Want to contribute? See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Attribution

The agent's instructions and every command it runs come from Circle's [skills](https://github.com/circlefin/skills) and [setup document](https://agents.circle.com/skills/setup.md), fetched and installed at runtime.

## Legal disclaimer

Sample apps provided for demonstration and educational purposes only, intended for Arc testnet use only, and not production-ready. See [Arc.io](https://arc.io) for more.