# Sync error codes

The four codes `getSyncHealth` returns, what each actually means, and the fix.
Quote the resolution, not the code — customers do not want to hear
`QUOTA_EXCEEDED`.

## `DEVICE_LIMIT`

**Means:** the account has more devices than the plan allows, and the newest
one over the line stops syncing. Free syncs 3 devices; paid plans are
unlimited.

**Fix:** remove a device the customer no longer uses under **Settings →
Devices**. Syncing resumes within a few minutes, no restart needed. Upgrading
also works, and costs money, so mention it second.

**Say:** "Your account is syncing 4 devices and the Free plan covers 3, so the
iPad stopped. Removing a device you no longer use under Settings → Devices will
bring it back — or a paid plan lifts the limit entirely."

## `QUOTA_EXCEEDED`

**Means:** storage is full. Uploads are rejected; downloads and existing files
are unaffected.

**Fix:** two routes, and mention both. Emptying the trash is the one people
miss — deleted files count against the quota until they are purged, and the
trash holds 30 days of them. Otherwise, upgrade.

**Say:** "You're at 14.8 GB of your 15 GB, so new uploads are being rejected.
Emptying the trash usually frees a surprising amount — deleted files still
count until they're purged. If that isn't enough, a paid plan starts at 2 TB."

## `REGION_DEGRADED`

**Means:** a platform incident. Not the customer's account, not their device,
not their network.

**Fix:** none on their side. Give the status note verbatim and set the
expectation that it resolves without action.

**Say:** "This is on our side — our eu-west sync backend has been degraded
since 06:20 UTC and engineers are on it. No data is lost and you don't need to
change anything; it will catch up on its own."

Never pair this with troubleshooting steps. Asking someone to sign out and back
in during an outage makes it look like the outage was their fault.

## `FILE_TOO_LARGE`

**Means:** one file exceeds the plan's per-file cap — 2 GB on Free, 50 GB on
paid. Everything else on the account keeps syncing, which is why this one hides
so well.

**Fix:** split the file, compress it, or upgrade.

**Say:** "archive.zip is 3.1 GB and the Free plan caps individual files at
2 GB, so that one file is being skipped while everything else syncs. Splitting
the archive works, and paid plans raise the cap to 50 GB."

## Precedence

More than one code in the same window? Resolve in this order:

1. `REGION_DEGRADED` — nothing else can be trusted while the platform is
   degraded
2. `QUOTA_EXCEEDED` — blocks every upload on the account
3. `DEVICE_LIMIT` — blocks one device
4. `FILE_TOO_LARGE` — blocks one file
