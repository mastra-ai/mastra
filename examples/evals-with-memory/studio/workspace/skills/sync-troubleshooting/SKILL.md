---
name: sync-troubleshooting
description: "Diagnose why a Nimbus customer's files stopped syncing. Use this skill whenever someone reports missing files, stuck uploads, a device that will not sync, or sync that worked yesterday and does not today. Covers the order to check things in, how to read sync error codes, and how to tell an account problem from an outage."
license: Apache-2.0
metadata:
  author: Nimbus Support
  version: "1.2.0"
---

# Sync troubleshooting

"It isn't syncing" is four different problems wearing the same sentence. This
skill is the order to rule them out, which matters because the cheapest check
also catches the case where nothing is wrong with the account at all.

## Check in this order

Do not skip step 1. Diagnosing an account for twenty minutes during a regional
outage is the single most common way this goes wrong, and the customer ends up
being told to change settings that were never the problem.

1. **Is the platform healthy?** `getServiceStatus` for the account's region.
   Degraded region plus failures on *every* device at once means it's us. Stop
   here, say so, and give the status note.
2. **Is the account over a limit?** `getAccountOverview`. Storage at or near
   100%, or a device count above the plan's device limit, explains most of the
   rest.
3. **Which device, and since when?** `listDevices`. One device stuck while the
   others are current is a device problem. All devices stuck together is not.
4. **What is the actual error?** `getSyncHealth`. Read `dominantCode` first —
   the code names the cause and the fix follows from it.
5. **Has this happened before?** `searchPastTickets`. Most sync problems are
   recurrences with a written resolution.

## Reading the signals

| What you see | What it means | What to say |
|---|---|---|
| Region degraded, all devices failing | Platform incident | It's us, we're on it, no action needed |
| One device `blocked`, others syncing | That device is over a limit | Fix the limit, not the device |
| All devices `blocked`, region healthy | Account-level limit, usually quota | Clear space or upgrade |
| Failures stop at a date, device `offline` | Device went away | Confirm it's still in use |

Error codes are in [references/error-codes.md](references/error-codes.md) with
the resolution for each.

## The trap

A customer who bought a new laptop or tablet last week and now has "a device
that won't sync" is almost never broken. They are over the Free plan's
three-device limit, and the device that stopped is the oldest one, not the new
one. Check `listDevices` for `overLimitBy` before anything else — it is one
call and it ends the conversation.

## What not to do

- Don't ask the customer to reinstall before checking status and limits. It
  costs them an hour and fixes neither of the two most common causes.
- Don't recommend an upgrade for a device-limit problem without saying that
  removing an unused device is free and takes ten seconds. Both are true; only
  one costs money, and leading with the paid option reads as a sales pitch.
- Don't promise a fix time for a regional incident. Give the status note as
  written and say updates land on the status page.
