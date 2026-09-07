/** A quoted reply being composed; owned by the mount parent so list and composer share it. */
export interface CommentQuoteDraft {
  commentId: string;
  quote: string;
  authorName?: string;
}
