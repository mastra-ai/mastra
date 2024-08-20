import { ErrorResponse, lists } from '@mailchimp/mailchimp_marketing';

export function isMailchimpErrorResponse(error: any): error is ErrorResponse {
  return (
    error && typeof error.status === 'number' && typeof error.title === 'string' && typeof error.detail === 'string'
  );
}

export type MailchimpClientConfig = {
  accessToken: string;
  server: string;
};

export type MailchimpMember = lists.MembersSuccessResponse;
