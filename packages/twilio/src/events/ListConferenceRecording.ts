import { EventHandler } from '@arkw/core';

import { API_V2010_ACCOUNT_CONFERENCE_CONFERENCE_RECORDINGFields } from '../constants';

import { TwilioIntegration } from '..';

export const ListConferenceRecording: EventHandler<TwilioIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient, config },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-API_V2010_ACCOUNT_CONFERENCE_CONFERENCE_RECORDING-ListConferenceRecording`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { referenceId } = event.user;
    const { DateCreated, PageSize, Page, PageToken, AccountSid, ConferenceSid } = event.data;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Conferences/{ConferenceSid}/Recordings.json'].get({
      params: { AccountSid, ConferenceSid },
      query: { DateCreated, PageSize, Page, PageToken },
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('error in fetching ListConferenceRecording', JSON.stringify(error, null, 2));
      return;
    }

    const d = await response.json();

    const records = d?.['recordings']?.map(r => {
      return {
        externalId: r.sid,
        data: r,
        entityType: 'API_V2010_ACCOUNT_CONFERENCE_CONFERENCE_RECORDING',
      };
    });

    if (records && records?.length > 0) {
      await dataLayer?.syncData({
        name,
        referenceId,
        data: records,
        type: `API_V2010_ACCOUNT_CONFERENCE_CONFERENCE_RECORDING`,
        properties: API_V2010_ACCOUNT_CONFERENCE_CONFERENCE_RECORDINGFields,
      });
    }
  },
});
