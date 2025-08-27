export interface FeedbackData {
  id: string;
  feedback: string;
  rating: number;
  page: string;
  userAgent: string;
  timestamp: string;
}

export type ErrorWithMessage = {
  message: string;
};
