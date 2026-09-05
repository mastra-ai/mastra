---
'@mastra/playground-ui': minor
---

Added a `thread` variant to the `Comment` component, plus `CommentQuote`, `CommentEditor` and `CommentArrival` parts, so a dense comment feed (avatar gutter, grouped rows, quoted replies, inline editing, hover actions) can be built from the design system instead of hand-rolled per app.

```tsx
<Comment variant="thread">
  <CommentItem continued={sameAuthorAsAbove} highlighted={isLinkedComment}>
    <CommentItemAvatar>{sameAuthorAsAbove ? null : <Avatar name={author} />}</CommentItemAvatar>
    <CommentItemContent>
      <CommentItemHeader>
        <CommentItemAuthor>{author}</CommentItemAuthor>
        <CommentItemTimestamp dateTime={occurredAt}>{relative}</CommentItemTimestamp>
      </CommentItemHeader>
      <CommentQuote authorName={replyTo.authorName} quote={replyTo.quote} />
      <CommentItemBody>{body}</CommentItemBody>
    </CommentItemContent>
    <CommentItemActions>{/* revealed on row hover */}</CommentItemActions>
  </CommentItem>
</Comment>
```

The existing `default` and `embed` variants are unchanged.
