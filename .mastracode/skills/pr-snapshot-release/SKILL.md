---
name: pr-snapshot-release
description: Retired. Snapshots from a pull request or branch are no longer published. Use when asked to release, publish, or create a PR snapshot, branch snapshot, canary package build, or branch-specific npm tag, and route the request to the alpha release path in the playground-snapshot-release skill.
---

<overview>
PR and branch snapshots are retired. Mixing different versions of the same package, for example a snapshot and an alpha, can install conflicting copies. A change reaches consumers through the `alpha` dist-tag published from `main`. This skill authorizes no release, dispatch, or push.
</overview>

<constraints>

- MUST NOT dispatch `publish_type=snapshot` or `publish_type=playground-snapshot`, publish a custom branch tag, or fall back to a snapshot because alpha is unavailable.
- MUST NOT dispatch any release workflow without the user's explicit approval to start that release.

</constraints>

<workflow>

1. Say in one sentence that snapshots are retired.
2. Follow the `playground-snapshot-release` skill: confirm the change has merged to `main`, resolve each needed package's `alpha` version, and verify the published alpha includes the change.
3. If it has merged but no alpha includes it, offer the wait or, with explicit approval, a manual Cron Alpha Version run on `main`, as that skill describes.

</workflow>
