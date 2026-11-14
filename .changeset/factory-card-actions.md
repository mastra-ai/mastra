---
'@mastra/factory': minor
---

**Pull requests link to their issue's card on their own.** A pull request that closes an issue now links to that issue's unfinished card, whoever opened it and whichever board the card is on. Linking moves nothing by itself: the card gets a `pull_request.opened` event, and the default rule `Trusted pull requests take a waiting issue to Review` moves a waiting card to Review when the pull request's author is trusted. Stored routes that joined pull requests to cards (`joinClosedIssue: true`) are switched off and kept for history; new ones are refused with `422 join_retired`.

**Nothing runs on an outside author's pull request until a person picks it.** An outsider's linked pull request never becomes the card's working pull request on its own, its pushes and review requests don't re-review it or move the card, and its comments don't reach the card's sessions. Its merge or close still moves the card. A person picks it with the new endpoint:

```bash
curl -X PUT "$FACTORY_URL/web/factory/projects/$PROJECT/work-items/$CARD/working-pull-request" \
  -H 'content-type: application/json' -d '{ "pullRequest": 17, "expectedRevision": 4 }'
```

When the working pull request closes unmerged, the card falls back to its first trusted open pull request, never an outsider's.

**Card-move rules can send a card to another board.** A route that moves existing cards can set `moveToBoardKey` to send the card to a phase on another board. The card keeps its id, the old phase's sandbox stops and the target phase's runner starts.

**Rules test pull request trust separately.** `item.trusted` replaces `author.trusted` (rules saved with the old name still work), and the new `pullRequest.trusted` tests the event's pull request author, or the author of the card's working pull request.

```json
{ "field": "pullRequest.trusted", "operator": "equals", "value": true }
```
