# Agent Builder — Product Requirements

Status: Draft
Owner: Agent Builder
Reviewers: Engineering, Design, DevRel

> This document describes **what Agent Builder must do and why**. It does not prescribe how to build it. Every numbered requirement is a product behavior that an engineer, designer, or PM can verify without looking at code.

---

## 1. Vision

Mastra Studio today is built for engineers. To turn Mastra into a team product, we need a second surface — **Agent Builder** — where non-engineer members can create agents, share them with teammates, connect them to real channels like Slack, give them real capabilities like browsers and sandboxes, and put them on a schedule. The admin surface stays exactly as it is.

The product is successful when a non-engineer can:

- Create, edit, and chat with an agent in the browser.
- Share it with teammates, discover what others have shared, and star what they like.
- Put an agent into Slack, give it a browser, or schedule it — in a few clicks, without editing config.
- Never encounter admin-only chrome while doing any of the above.

---

## 2. User outcomes

These are the experiences the product must deliver. Everything in §4 onward serves at least one of these.

- **Member creates an agent.** Lands in a simple shell, makes an agent with a name and avatar, chats with it.
- **Member shares work.** Publishes an agent or skill; teammates can discover and star it.
- **Admin shapes the surface.** Turns the whole feature on or off, hides sections, and can preview the member experience without signing out.
- **Member puts an agent into Slack.** Clicks "Add to Slack," picks a registered Slack app, the agent replies to `@mentions` in Slack.
- **Member gives an agent browser access.** Picks a browser from a short list set up by an admin; the agent can now browse.
- **Admin sets a default sandbox.** Every new member-created agent inherits it. No picker appears to members.
- **Member schedules a routine.** Writes a prompt, picks a schedule, optionally carries context across runs.

---

## 3. In scope vs. out of scope

**In scope (v1).**

- Member-facing shell for agents, library, and configuration.
- Identity on records (authorship, visibility) and a personal library of preferences.
- Team Library for published agents and skills, with starring.
- Avatars for agents.
- Slack channel attachment from admin-registered Slack apps.
- Browser capability picker from admin-registered browsers.
- Admin-configured default sandbox for newly created agents.
- Scheduled routines with optional thread-continuation.
- Admin configuration and feature gating.

**Out of scope (v1).**

- Projects workspace — multi-agent coordination, supervisor + tasks + `@mention` routing. Moved to **Stretch goals (§14)**.
- Channels other than Slack (Discord, Telegram).
- Member-configured browsers or sandboxes.
- Real-time multi-user collaboration inside a chat.
- Distributed routine scheduling across multiple server instances.

---

## 4. Identity and ownership

- **R4.1** Every stored agent and skill has an identifiable author.
- **R4.2** A record has a visibility of **private** or **public**. Private is the default.
- **R4.3** Only the author of a record can modify or delete it.
- **R4.4** Private records by another author are never visible to a member.
- **R4.5** Member-facing lists can be filtered by **Mine**, **Team** (others' public), or **All** (union of the two).
- **R4.6** Existing records that predate authorship read as unowned + private. They do not break and are not retroactively reassigned.

---

## 5. Personal preferences

- **R5.1** A member can star agents and skills and see their starred items across sessions.
- **R5.2** An admin can toggle a **preview as member** mode that shows them the member shell without signing out. The toggle persists per admin.
- **R5.3** Personal preferences apply to the signed-in user only. A member never sees or affects another member's preferences.
- **R5.4** When no authentication is configured, preference-dependent controls degrade gracefully: nothing crashes, nothing pretends to persist.

---

## 6. Member shell and navigation

- **R6.1** A member lands on a simplified shell that presents three top-level sections: **Agents**, **Library**, and **Configure**. (A fourth **Projects** section appears only if the stretch feature ships — see §14.)
- **R6.2** Admins land on the existing admin surface by default. Existing admin behavior is unchanged.
- **R6.3** Navigation inside the member shell stays inside the member shell. A member cannot accidentally end up on the admin surface.
- **R6.4** The shell hides admin-only chrome (version pickers, debugging footers, settings links) unless the viewer is an admin in preview mode.

---

## 7. Team Library

- **R7.1** Members can browse agents and skills that teammates have published as public.
- **R7.2** A card in the Library shows the author's display name and a star control.
- **R7.3** The owner of a record can flip its visibility between private and public from the same surface where they edit it.
- **R7.4** Changing visibility on a skill does not discard that skill's version history or prior configuration.
- **R7.5** When a record is unpublished, it disappears from other members' Library on their next refresh.

---

## 8. Avatars

- **R8.1** A member can set an avatar on an agent they own, including at the moment the agent is first created.
- **R8.2** Cards and chat headers show the avatar at multiple sizes without layout shift; if there is no avatar, a stable fallback is used.
- **R8.3** Only the owner of an agent can change or remove its avatar.
- **R8.4** Avatar payloads are bounded in size so that one agent cannot bloat the team's storage.
- **R8.5** Skills do not carry avatars in v1.

---

## 9. Slack channel connect

- **R9.1** An admin can register one or more Slack apps for the team to use. Registration is an admin-only concern; member-facing UI never sees credentials.
- **R9.2** A member viewing an agent they own can attach that agent to one of the admin-registered Slack apps with a single click.
- **R9.3** Attaching and detaching Slack is restricted to the agent's owner.
- **R9.4** After attachment, the agent responds to `@mentions` in Slack and retains conversation context across turns in a Slack thread.
- **R9.5** If no Slack app is registered, the "Add to Slack" control is absent — not disabled, not "empty."
- **R9.6** The product is extensible to other channels (Discord, Telegram) later without a member-visible redesign.

---

## 10. Browser capability

- **R10.1** An admin can register one or more browsers for the team. Each has a display name; credentials are never visible to members.
- **R10.2** A member creating or editing an agent can pick from the list of registered browsers, including a "None" option, which is the default.
- **R10.3** If the admin has registered no browsers, the browser picker is absent from member UI.
- **R10.4** Changing or clearing an agent's browser choice is restricted to the agent's owner.
- **R10.5** Admins can update a registered browser (e.g., rotate credentials) without members having to re-pick.
- **R10.6** If a registered browser supports a live view, the member sees it in the agent's chat the way Studio already supports today.

---

## 11. Default sandbox

- **R11.1** An admin can configure at most one default sandbox for the team.
- **R11.2** Every agent created by a member after that point inherits the default sandbox. Members never see a sandbox picker.
- **R11.3** Changing or clearing the default sandbox does not silently modify existing agents.
- **R11.4** When no default sandbox is configured, new member-created agents simply have no sandbox-powered capabilities; nothing misbehaves.
- **R11.5** The Configure surface shows the admin whether a default sandbox is set, and makes it easy to understand the consequence of removing it.

---

## 12. Routines

- **R12.1** A member can attach a named routine to an agent. A routine has a prompt, a schedule, and a name.
- **R12.2** Schedules support at least: a time of day, specific days of the week, and "every day." Timezones are explicit.
- **R12.3** A routine can be set to **remember where it left off** (the agent resumes the same conversation on each run) or to **start fresh** (a new conversation each run).
- **R12.4** A member can enable, disable, edit, delete, or run now any routine they created.
- **R12.5** A routine's run history is visible: when it ran, whether it succeeded, and a link to the resulting conversation.
- **R12.6** Disabling a routine stops future runs immediately. Re-enabling it resumes at the next scheduled time; missed runs are not backfilled.
- **R12.7** If the agent behind a routine is deleted, the routine is automatically disabled and the reason is recorded.
- **R12.8** Only the routine's creator can edit, delete, disable, or run it. A member can schedule routines against any agent they are allowed to chat with.

---

## 13. Admin configuration and feature gate

- **R13.1** The entire Agent Builder surface is off by default. An admin turns it on at the server level.
- **R13.2** When off, existing admin workflows are completely unaffected — no new routes, no new UI, no new storage expectations.
- **R13.3** When on, admins can shape the member experience: hide the Library, disable sharing, disable starring, disable avatar uploads, restrict skill creation, cap recents, set a default memory configuration.
- **R13.4** Admins register Slack apps, browsers, and a default sandbox through the same admin configuration surface. Members see only the resulting picker/display — never credentials.
- **R13.5** The feature is enterprise-licensed. A misconfigured or missing license is a clear, up-front failure, not a silently degraded experience.

---

## 14. Stretch goals

These are wanted but not required for the initial release. They build on the v1 primitives and can ship later without rework.

### 14.1 Projects workspace

**Vision.** Some goals need more than one agent. A project is a shared workspace where a supervisor coordinates several agents around a single goal, with a visible task list and direct-to-agent addressing.

**Outcomes.**

- A member creates a project with a goal and invites existing agents into it.
- The project has a single persistent conversation; the side panel shows team members and tasks.
- The supervisor can add, update, and complete tasks as the conversation progresses; changes appear live.
- A member can address one specific invited agent mid-conversation and have only that agent respond.
- The supervisor can propose a new agent to add to the project; the member accepts or declines.
- Projects respect the same ownership rules as agents — only the owner can modify the project or invite/remove agents.
- Projects appear as a new top-level section in the member shell; the section is hidden until this feature ships.

### 14.2 More channels

Extend the Slack model to Discord, Telegram, and other channels members commonly ask for.

### 14.3 Distributed routine scheduling

Run the routine scheduler safely across multiple server instances for customers running high-availability deployments.

---

## 15. Non-functional requirements

- **Compatibility.** Nothing in Agent Builder breaks the existing admin surface. Records created before v1 remain readable and editable.
- **Security.** Ownership rules are enforced by the product, not by hiding UI. Admin-only credentials (Slack tokens, browser keys, sandbox keys) never appear in anything a member can see.
- **Privacy.** A member's private records are invisible to anyone else, regardless of which list or search surfaces the request.
- **Accessibility.** The member shell meets the same accessibility baseline as the existing Studio.
- **Performance.** List surfaces (Library, Agents, Routines, run history) remain responsive at team-scale volumes.
- **Documentation.** Every member-visible concept has a docs page before GA.

---

## 16. Success criteria

The release is successful when **all** of the following are true:

- A member who is not an admin can complete each of the §2 outcomes end-to-end without seeing admin-only chrome.
- An admin can turn the whole feature off with a single configuration change; the admin surface continues to work untouched.
- Every requirement in §4–§13 is verifiable by a test or a manual check, and every one of those checks passes before the feature is enabled for licensed customers.
- A team running the example app can complete the §2 outcomes against a local environment.

---

## 17. Open questions

These are decisions we will make before GA but do not need to answer to start shipping.

- **Sharing unpublish.** If a member unpublishes a record that others have starred, do they see a warning? (Recommendation: yes, a simple confirmation; no dependency graph in v1.)
- **Configure for members.** Does the Configure section show to non-admin members? (Recommendation: yes, but limited to personal appearance and personal skill creation.)
- **Slack attach behavior.** Does attaching Slack auto-publish a never-published agent so the bot always has a current version to run? (Recommendation: yes, once; otherwise use the currently published version.)
- **Routine timezones.** Do schedules default to the server's timezone or prompt the member to set their own? (Recommendation: prompt, with a clear banner until set.)
- **Admin preview scope.** Does the "preview as member" toggle also hide admin-only sections of Configure, or only switch the shell chrome? (Recommendation: only the shell.)
