# Studio walkthrough

Use the retail example to browse Knowledge, ask about Store 42's payment terminal history, and turn a technician's chat message into a reviewed case entry.

Install the template dependencies and set your API key. If Studio is already running from the template directory, stop that launch first. [Quickstart and Studio sign-in](../README.md)

From the template directory, seed the guides and fictional cases into a fresh local database, then start Studio.

```bash
export DATABASE_PROVIDER=local SUPPORT_EXAMPLE=retail-pos
export SUPPORT_DATABASE_URL="file:$(mktemp -d)/support.db"
npm run knowledge:seed
npm run knowledge:seed -- --dataset retail-pos-history
npm run dev
```

Open Studio as `retailops-store-42` using the private credential file path printed by `npm run dev`. Keep the token-bearing URL private and use separate browser sessions when switching profiles.

If Studio returns `401`, use the token from the latest launch. If Support reports a missing policy, check that Studio and the seed use the same example and database. [Datasets and examples](datasets-and-examples.md)

| Profile                | Use                                       |
| ---------------------- | ----------------------------------------- |
| `retailops-store-42`   | Support for Store 42                      |
| `retailops-colleague`  | A second technician for Store 42          |
| `retailops-store-73`   | Support for another RetailOps store       |
| `fieldretail-store-42` | Support for a store in a different tenant |
| `retailops-reviewer`   | Review findings for RetailOps Store 42    |

## 1. Explore Knowledge and ask about Store 42

As `retailops-store-42`, open **Knowledge** and select **support**. Open **Square Terminal network checks**, then find **Fictional wifi network** in Store 42's case history. The case records the guest Wi-Fi problem and includes a follow-up note.

Start a new **Support** chat and send this message.

```text
What's the support history for connection issues at Store 42? Give me a quick summary of what was fixed, what's still open, and which cases those details came from.
```

Look for the earlier Wi-Fi fix in `cases/wifi-network` and the unresolved Ethernet issue in `cases/intermittent-open`.

## 2. Confirm and review a private finding

In the same **Support** chat, describe the outcome of a new fictional visit.

```text
Confirmed: On November 25, 2026, I worked on case RET-1060 at Store 42. The back-counter terminal kept dropping its Ethernet connection. I found a broken latch on the cable. With the store's approval, I replaced the cable and ran three connection checks. All three passed. No offline payments were pending. Please save this observation to Store 42's service history for review.
```

The chat saves the technician's message. A separate reviewer approves the entry before it appears in Knowledge. If you're recording the demo, run the review between takes.

In a second terminal, use Bash or Zsh with `curl` and `jq`. Set `credentials` to the launcher file path. Copy `thread_id` from the Studio conversation URL exactly, including letter case. Set `confirmation_start` to the first sentence as it appears in the saved `Confirmed:` message. For another use case, use its technician and reviewer profile IDs.

```bash
base=http://127.0.0.1:4111
credentials='/path/printed/by/npm-run-dev'
thread_id='THREAD_ID_FROM_STUDIO'
technician_profile=retailops-store-42
reviewer_profile=retailops-reviewer
confirmation_start='Confirmed: On November 25, 2026, I worked on case RET-1060 at Store 42.'
audience=private
```

Find the stored message and use it as the source for **Review**.

```bash
studio_api() {
  local token=$1 route=$2
  shift 2
  curl -fsS -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' "$base/api$route" "$@"
}

active_profile() {
  jq -ec --arg id "$1" \
    '.[] | select(.profile.id == $id and .expiresAt > (now * 1000))' "$credentials"
}

prepare_review() (
  set -euo pipefail
  printf 'Loading technician and reviewer credentials.\n' >&2
  technician=$(active_profile "$technician_profile")
  technician_token=$(jq -er '.token' <<< "$technician")
  source_actor_id=$(jq -er '.profile.actorId' <<< "$technician")
  reviewer_token=$(active_profile "$reviewer_profile" | jq -er '.token')

  printf 'Reading the technician thread.\n' >&2
  messages=$(studio_api "$technician_token" "/memory/threads/$thread_id/messages?agentId=support")
  message_id=$(jq -er --arg opening "$confirmation_start" '
    [.messages[] | select(.role == "user") |
      select(any(.content.parts[]?; .type == "text" and (.text | startswith($opening)))) |
      .id] | if length == 1 then .[0] else error("Expected one matching chat message") end
  ' <<< "$messages")

  printf 'Preparing the reviewer proposal.\n' >&2
  run_id=$(studio_api "$reviewer_token" '/workflows/review/create-run' --data '{}' | jq -er '.runId')
  studio_api "$reviewer_token" "/workflows/review/start-async?runId=$run_id" --data "$(
    jq -cn --arg threadId "$thread_id" --arg messageId "$message_id" \
      --arg sourceActorId "$source_actor_id" --arg audience "$audience" \
      '{inputData: {$threadId, $messageId, $sourceActorId, $audience}}'
  )" | jq -e '.status == "suspended" or error("Review ended with status " + .status)' >/dev/null

  studio_api "$reviewer_token" "/workflows/review/runs/$run_id" |
    jq -ec --arg runId "$run_id" '
      .steps["review-decision"].suspendPayload |
      if type == "object" then {$runId, proposal: .} else error("Missing review proposal") end'
)

review=$(prepare_review)
jq '.proposal | {destination, candidate}' <<< "$review"
```

If the thread lookup returns `403`, check the thread ID's letter case and verify that the conversation was started with the selected technician profile. If no message matches, compare `confirmation_start` with the actual chat text, including any dates.

Check the proposed content, destination, and evidence against the chat. For the private example, the destination scope should be `customer:retailops:store-42`. When the change is ready to publish, approve the proposed revision in the same terminal.

```bash
publish_review() (
  set -euo pipefail
  run_id=$(jq -er '.runId' <<< "${review:?Prepare a review first}")
  revision=$(jq -er '.proposal.revision' <<< "$review")
  reviewer_token=$(active_profile "$reviewer_profile" | jq -er '.token')
  studio_api "$reviewer_token" "/workflows/review/resume-async?runId=$run_id" --data "$(
    jq -cn --arg revision "$revision" \
      '{step: "review-decision", resumeData: {
        decision: "approve", $revision, reason: "Checked the proposed change against the evidence."
      }}'
  )" | jq -er '.result | if .status == "published" then .reference else error(.status) end'
)

publish_review
```

As `retailops-store-42`, refresh **Knowledge → support**. Use the returned reference to open the new page or find the note on its case page. Look for the broken cable latch and the three successful checks. To try rejection with a different confirmation, set the decision to `reject`, read `.result.status` from the response, and check that the proposed change is absent.

## 3. Approve a shared finding and reuse it

In **Support** as `retailops-store-42`, send a separate confirmation with a public guide reference. The example uses guide version 1 from a fresh seed.

```text
Confirmed: The terminal had joined the guest Wi-Fi while a nearby device on the intended network stayed connected. With the store's approval, I selected the intended network and verified that the connection stayed up through three checks. No offline payments were pending. Public reference docs:retailops#guides/network, version 1.
```

Repeat the review with `audience=tenant`, the current thread ID, and the first sentence of this confirmation as `confirmation_start`. Before approving, check that the guidance omits private details, explains when it applies, and cites the current version of the public guide.

As `retailops-store-73`, start a fresh **Support** chat and ask, “What reviewed guidance do we have for a terminal that joined the guest Wi-Fi?” Look for a `tenant:retailops#learnings/…` reference.

## 4. Reuse customer history in a fresh chat

After publishing the private finding, open a fresh **Support** chat as `retailops-store-42` or `retailops-colleague`. Ask, “What did we observe when the back-counter terminal at Store 42 kept dropping its Ethernet connection?” Look for the approved case or note and its Knowledge reference.

## 5. Check isolation

Browse **Knowledge** as `retailops-store-73` or `fieldretail-store-42` and copy a private case reference. Try that reference as `retailops-store-42` to check that access is restricted. As `retailops-colleague`, check that you can see the shared Store 42 cases and that the original technician's chat stays private.

## 6. Refresh the policy in the same chat

Ask about factory-resetting a terminal with pending offline payments. Edit the retail policy to add a step to contact the on-duty lead. Approve the revised policy for each affected tenant and reapply the dataset. Continue the same chat and look for guidance that includes the new step. [Retail policy](../knowledge-datasets/retail-pos/retail-policy.md) · [Policy approval steps](datasets-and-examples.md#write-a-required-safety-policy)
