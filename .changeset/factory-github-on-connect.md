---
'@mastra/factory': minor
---

Organizations using Platform GitHub can now move onto the new Mastra Factory GitHub apps.

**Switching to the Mastra Factory apps.** In **Settings → Source control**, an organization admin installs **Mastra Factory** and **Mastra Factory Reviews** on each GitHub account Factory uses, then chooses **Switch**. The page lists any app, account or linked repository the new apps can't reach yet, and the switch waits until there are none. Project links, cards and sessions carry over. After the switch:

- Factory calls GitHub directly with the apps' tokens, and reads the apps' webhooks from their Mastra Connect event logs. Its reviews and review checks come from Mastra Factory Reviews, and everything else from Mastra Factory.
- A person can connect their own GitHub account in **Settings → Connected accounts**, through the Mastra Factory app or with a personal access token. Factory's writes still come from the apps and name the person, as with the Mastra GitHub App; their own account is used only to change their own pending review.
- Accounts both apps are installed on later are picked up when Source control loads.
- Agent sandboxes get a token scoped to their session's repositories, never one for the whole installation.

**Reviews in the Checks tab.** While Factory reviews a pull request, the review now also shows in the pull request's Checks tab, as `Factory review` (named after `FACTORY_REVIEW_STATUS_NAME` when set). The check is in progress while the review is queued or running, and ends as a success when the review approves and neutral otherwise (changes requested, a failed run, a cancelled run), so a Factory review never fails a required check. A check left open on an older commit, because the pull request moved on or a newer review replaced the run, is closed as skipped. This works on both sets of GitHub apps and on a self-managed GitHub App with the `checks: write` permission.

Organizations that don't switch keep using the Mastra GitHub App, with one change: a webhook Factory fails to handle three times in a row is now skipped and repaired by the next reconcile, instead of holding up every later webhook for its repository. There is no switch back.
