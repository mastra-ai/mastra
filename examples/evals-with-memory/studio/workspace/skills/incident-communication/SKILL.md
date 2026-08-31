---
name: incident-communication
description: "How to talk to customers during a Nimbus outage or degraded service. Use this skill when getServiceStatus reports anything other than operational, when several customers report the same failure at once, or when a customer asks whether a problem is on their side."
license: Apache-2.0
metadata:
  author: Nimbus Support
  version: "1.1.0"
---

# Incident communication

During an incident the customer has already lost time. What they need is to
stop spending more of it, which means knowing quickly that it isn't theirs to
fix.

## Say four things, in this order

1. **It's us.** Say it first and without hedging. Every sentence before this
   one reads as blame.
2. **What is affected.** Name the symptom in their words, not the subsystem.
   "Uploads are failing", not "the sync backend is degraded".
3. **Their data is safe** — when it is. Say it explicitly. Nobody asks this
   question out loud and everybody is thinking it.
4. **What happens next.** Who is working on it, where updates appear, and that
   it resolves without them doing anything.

> This one's on us — our eu-west region has been having trouble since 06:20 UTC
> and uploads are failing intermittently. Nothing has been lost, and you don't
> need to change anything on your side; it'll catch up on its own once we're
> back. Our engineers are on it and updates go to status.nimbus.example.

## Do not

- **Do not give a fix time** unless the status note contains one. "Should be
  fixed within the hour" that slips becomes a second complaint.
- **Do not offer troubleshooting steps.** Asking someone to sign out and back
  in during an outage tells them you think it is their fault, and they will
  remember that after the incident closes.
- **Do not apologise more than once.** One clear apology reads as accountable.
  Four read as evasive.
- **Do not say "some users".** The person you are talking to is affected. Say
  what is affected.
- **Do not open a ticket for a known incident.** See the escalation-policy
  skill: it buries the tickets that are not already known.

## Checking before you attribute

Do not tell a customer it's an incident without checking, and do not tell them
it's their account without checking either. `getServiceStatus` takes one call.
Getting this backwards in either direction is expensive: a customer told to
wait for a fix that isn't coming, or a customer sent to reinstall during an
outage.

The tell is breadth. One device failing while the others sync is not an
incident, whatever the status page says. Every device failing at once, in a
degraded region, is.

## After it resolves

If the customer wrote in during the incident, close the loop. Short, and
without asking anything of them.

> Quick follow-up — the eu-west issue is resolved and your devices should have
> caught up. Nothing was lost. Sorry for the disruption.

Customers who hear this once trust the next status page they see.

## When someone asks for compensation

Do not decide it. Note it, escalate at `normal`, and say a human will pick it
up. Refund eligibility for a *purchase* is a self-serve check; goodwill credit
for an *incident* is a judgment call that is not yours.
