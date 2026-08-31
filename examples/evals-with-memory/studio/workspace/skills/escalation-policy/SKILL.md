---
name: escalation-policy
description: "When to open a support ticket and when to answer instead, with the severity matrix Nimbus triages on. Use this skill before calling createSupportTicket, and whenever a customer asks for a human, reports data loss, disputes a charge, or raises a security or privacy concern."
license: Apache-2.0
metadata:
  author: Nimbus Support
  version: "2.0.0"
---

# Escalation policy

Opening a ticket costs a person twenty minutes. Not opening one when you should
costs a customer their afternoon. This is where the line sits.

## Answer it yourself when

- The documentation covers it: plan limits, file caps, trash retention, how to
  change plans.
- The account data explains it: over a device limit, out of storage, a file
  above the plan cap.
- A resolved ticket already answers it. Check `searchPastTickets` first — most
  problems are recurrences.
- It's a live incident and the status page says what's happening. A ticket adds
  nothing; the fix is already in flight.

## Escalate when

Any one of these is enough. Do not weigh them against each other.

- **Data loss.** Files missing that were not deleted by the customer. Always
  escalate, always `high` or above, even if it later turns out to be sync lag.
- **Billing disputes.** A charge the customer says they did not authorise.
  Eligibility checks are self-serve; disputes are not.
- **Security or privacy.** Suspected account compromise, an unexpected device,
  a data request. Never troubleshoot these in the open.
- **Account ownership.** Anything that would give someone access to data you
  cannot prove is theirs.
- **The customer asks for a human.** Do not talk them out of it. Open the
  ticket and tell them it's open.
- **You have checked and still cannot explain it.** Say so plainly and escalate
  rather than guessing.

## Severity matrix

Pick from what is true now, not from how upset the message sounds.

| Severity | Use when | Response target |
|---|---|---|
| `urgent` | Data loss, active security incident, or a paying customer fully blocked | 1 hour |
| `high` | Billing dispute, suspected corruption, ownership question | 4 hours |
| `normal` | Explained but unresolved; needs a change support cannot make | 1 business day |
| `low` | Feature request, feedback, cosmetic issue | Best effort |

A regional incident is **not** an escalation, however many customers it
affects. It is already known. Adding tickets to a known incident buries the
ones that are not.

## Writing the summary

The summary is triaged by a human who has not read the conversation. One line,
what is broken, which account, what you already ruled out.

Good:

> acct-13 reports 4 files missing from Documents since 08-12; not in trash,
> quota not exceeded, region healthy. Suspect sync deletion, needs engineering.

Bad:

> Customer very upset about missing files, please help ASAP

The first can be picked up cold. The second requires reading everything again.

## Before you escalate

Say what you did. A customer who is handed off without hearing what was already
checked assumes it starts from zero, and asks again in the ticket.

> I've checked your storage, your devices and our service status, and none of
> them explain the missing files — so I've opened ticket TCK-9001 for our
> engineering team with everything I found. They'll come back to you within
> four hours.
