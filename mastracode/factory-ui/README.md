# Factory UI

`@internal/factory-ui` is the Factory React application. It owns pages, client state, API access, and browser tests.

## Development

Complete the [repository setup](../README.md#setup) and [GitHub App setup](../web/README.md#configure-local-onboarding). Then start the Docker services, the API, and the Vite dev server:

```shell
pnpm --dir mastracode/web dev:ui
```

Open `http://localhost:5173`. To restart one side without losing the other, start the Docker services with `pnpm --dir mastracode/web db:up`, then run `pnpm --dir mastracode/web api` and `pnpm --filter ./mastracode/factory-ui dev` in separate terminals.

Keep policy, validation, and persistence in [`@mastra/factory`](../factory/README.md), not in React.

## Onboarding

Onboarding is one page with four sections: **Codebase**, **Work**, **Accounts** and **Model** (three in local mode, which has no Accounts). The open section is a card; finished sections collapse to a summary row with a Change button that reopens them in place, and later sections are listed as upcoming rows. On desktop a preview of the open section sits beside the form; on mobile the preview is hidden and the primary action is pinned to the bottom of the screen.

The Model step opens as two numbered cards. **3 Accounts** asks who pays for model usage, and its three answers set the existing `modelScope` creation value. Company account is the default, and only the selected answer shows its description. **4 Model** holds the accounts that answer needs and updates as soon as the answer changes; local mode has a single connection, so it shows only Model, numbered 3. With **Company work and personal sessions** both appear at once, labelled **Factory work** and **Your sessions**, so it is clear there are two to set up. When the deployment offers the Mastra Gateway, each account starts with a **Mastra Gateway | Your own provider** switch, with the gateway selected as the recommended choice and connected by its own button in that account. **Create factory** sits under the cards, not in one, because it commits every section; it stays disabled until each account has a model. The gateway always bills the organization's Mastra credits, so with **Company work and personal sessions** only **Factory work** offers it; **Your sessions** goes straight to your own provider, and a sessions account left on the gateway is cleared when that answer is picked. Changing the answer folds the old accounts away and opens the new ones in place, and the answers' descriptions trade places without changing the list's height. Each account sits in its own inset on the Model card rather than in a card of its own. Opening, closing or reloading a section eases its height, so the sections below slide instead of jumping. **Your own provider** shows one provider row that opens a searchable list with a switch between **API key** providers (with a custom provider) and **Subscription** providers you sign in to. Without a gateway, the account shows that provider row directly. A search that only matches under the other switch position moves there. Once connected, the account's default model appears below the row. Local deployments show only the provider part. The answers reuse the setup labels shown in the Done row and in Settings → Models routing.

Every onboarding failure is explained where it happens, with a next step. GitHub App approval requests and refusals that return to onboarding show in the Codebase section instead of as toasts, and the section opens on GitHub for them even when the draft repository or the ready host is GitLab; a usable install needs no message because its repositories list. An installation that predates the link links to the organization's Settings → General page in Mastra Platform, where an organization admin chooses Refresh accounts, next to Refresh; a Mastra account already linked to another GitHub user, or a browser not signed in to Mastra Platform, points to Mastra Platform next to **Connect GitHub again**; a Factory account that isn't a Mastra account offers **Sign out**; other refusals offer **Connect GitHub again**. A pending approval request stays up, with Refresh, until a refresh lists new repositories. Mastra Platform hides a GitHub App installed on a personal GitHub account from an organization with more than one member, and GitHub status reports it as `personal_install_hidden`; the Codebase section then says why and offers **Choose another account** on every visit, and it can't be dismissed. An install that returns while status still finds no usable installation, for another reason, says so with the same two actions. When GitHub status can't load, the GitHub row says so and offers Retry instead of Connect, and no install message guesses a cause; an expired session offers **Sign in**, which returns to onboarding, and a failed repository refresh shows its error with Retry. While **Create factory** is disabled, a line above it says what is still missing; a create failure takes its place, inside the pinned bar on mobile, until a choice changes. Cancelling an API key or sign-in dialog keeps the provider the account already had. A member who can't connect the gateway for the company account starts on **Your own provider**, and the gateway's button says only an admin can connect it.

| Answer                             | Scope     | Factory work                                  | Interactive sessions                             |
| ---------------------------------- | --------- | --------------------------------------------- | ------------------------------------------------ |
| Company account                    | `factory` | Organization credentials and Factory default  | Organization credentials and Factory default     |
| Company work and personal sessions | `hybrid`  | Organization credentials and Factory default  | Session owner's personal credentials and default |
| Personal accounts                  | `user`    | Work owner's personal credentials and default | Session owner's personal credentials and default |

There is no fallback between account scopes. Each teammate configures their own personal account. Onboarding asks for one connection in `factory` or `user`, and a separate connection for each scope in `hybrid`. Existing scoped connections can be reused. Only organization key admins can add shared credentials; members can use connections already configured by an admin. When no company connection exists and the member cannot add one, both company answers are disabled and the section is locked to Personal accounts with a note explaining why. Local servers without web authentication show a single connection and create a `factory` Factory, so sessions and Factory work share its model.

Model pickers use `/web/config/models?scope=org` or `?scope=user`; live session catalogs still resolve the session owner and policy before considering settings filters. Credentials are saved when connected. Create factory stays disabled until the draft passes `completeOnboardingSchema` and every required account and model resolves; a saved model that is no longer available, a connection that changed, or a provider that left the provider list is explained in place, never silently replaced. A member on the company account sees one line saying why the providers they can't connect are disabled, and when the company account is locked their personal-accounts choice is saved with the draft, so adding a provider later never flips it back to the company account. Factory creation and the applicable default-model writes happen only when Create factory is clicked; setting a personal default also affects other work using that person's default.

The session-storage draft and the open section survive provider and GitHub redirects. The draft contains choices, never credentials; a draft without `modelScope` opens as Company account with its repository and model preserved. Failed creation shows its error above **Create factory** and resumes the pending Factory; changing its scope recreates that unfinished Factory rather than bypassing the admin-only scope update. Preview fixtures and screenshot tooling stay outside this package.

## Board views

Boards open as a list grouped by workflow status. Click a status heading, or focus it and press Enter or Space, to collapse or expand its issues. Counts and create actions remain available when a group is collapsed; creating an issue or following an issue link reveals its group.

Saved views can use either the list or Kanban layout. Existing saved views keep their selected layout.

## Board activity

Cards on the **Work** and **Review** boards show the last person recorded in the work item's audit history. Hover over the person's name or profile image to open the recent event timeline for that card.

Factory stores actor names and profile images in audit event metadata when events are written. For older events without that metadata, Factory resolves actor profiles through the configured authentication provider and falls back to the stored actor ID and an initial.

## Navigation

Opening a Factory lands on its first board. The retired Activity, Overview, Attention, Metrics, and Audit URLs also open that Factory's board landing. Activity and Audit log are no longer offered in the sidebar or global search.

Activity's unread badge, open-item dot, and attention chime are retired, including alerts for failed runs, mentions, and waiting agents. The Needs you and followed-discussion lists and their inbox read, archive, and restore actions are also removed. Board cards still offer failed-decision retries and proposal approval and dismissal.

Successful run completions continue to use the live Ready indicator and completion sound on sidebar session rows.

## Session titles

Slack sessions use the same automatic title generation as web sessions, including the preceding Slack thread context available to the agent. Until naming succeeds, the sidebar shows the session's work item title, or its branch when it has none. Older sessions that still show the generic `slack conversation` label keep it until observational memory retitles the conversation or the owner regenerates the title.

Owners can choose **Regenerate title** from a web or Slack session's sidebar menu to name it from its stored conversation. Regeneration uses the existing title model and does not start a workspace. Automatic naming failures leave the conversation usable; an explicit regeneration reports its error.

## Settings

The sidebar footer shows your profile picture (or an initial) and name, and links straight to settings, opening **Preferences**. **Preferences** holds the theme control (system, light, or dark appearance); **My account** shows your profile and holds **Log out**.

Settings navigation groups pages by topic: **Account**, **Agent** (Models, Memory, Skills, Behavior), and **Factory**. **Models** picks the Factory's routing (`user`, `hybrid`, or `factory`) and shows the personal and Factory defaults side by side; the defaults the routing leaves unused fold behind a **Settings** toggle, which `#personal-defaults` / `#factory-defaults` links open, so they can be set up before switching routing. Chats never borrow from the defaults their routing leaves unused. Without a chosen model, a session starts on the built-in default model its keys can run, which the empty model picker shows as **Built-in default**; the New session page asks for a provider or a model only when no key can run it. Without a personal thinking level, a personal chat starts at medium. **Memory** holds personal and Factory observational memory. Retired `personal-models`, `factory-memory` and `environment` URLs redirect to Models, Memory and Repositories, and navigation stays searchable. **Back to app** returns to the page where settings was opened, including its filters, even after switching sections or reopening settings from the sidebar footer.

## Tests

Use unit tests for isolated code and MSW tests for pages, routes, hooks, mutations, and React Query behavior.

```shell
pnpm --filter ./mastracode/factory-ui test:unit
pnpm --filter ./mastracode/factory-ui test:msw
pnpm --filter ./mastracode/factory-ui typecheck
pnpm --filter ./mastracode/factory-ui build
```

See [`AGENTS.md`](./AGENTS.md) for testing conventions.
