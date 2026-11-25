import { Notice } from '@mastra/playground-ui/components/Notice';
import { useStudioConfig } from '../context/studio-config-state';
import type { ConnectionFailure } from '../hooks/use-mastra-instance-status';

const AUTHORIZATION_STATUSES = [401, 403];

const getFailureMessage = (failure: ConnectionFailure, baseUrl: string, apiPrefix: string) => {
  if (failure.reason === 'invalid-url') {
    return { title: "That URL doesn't work", message: 'Start it with http:// or https://.' };
  }
  if (failure.reason === 'not-mastra') {
    return {
      title: 'Not a Mastra server',
      message: `Something else answers at ${baseUrl}${apiPrefix}. Check the URL and the API prefix.`,
    };
  }
  if (AUTHORIZATION_STATUSES.includes(failure.httpStatus)) {
    return {
      title: 'The server needs authorization',
      message: `${baseUrl} answers with error ${failure.httpStatus}. Add the header it expects, such as Authorization.`,
    };
  }
  return {
    title: 'No Mastra server found',
    message: `${baseUrl}${apiPrefix} answers with error ${failure.httpStatus}. Check the URL and the API prefix.`,
  };
};

export interface ConnectionFailureNoticeProps {
  failure: ConnectionFailure;
}

export const ConnectionFailureNotice = ({ failure }: ConnectionFailureNoticeProps) => {
  const { baseUrl, apiPrefix = '/api' } = useStudioConfig();
  const { title, message } = getFailureMessage(failure, baseUrl, apiPrefix);

  return (
    <Notice variant="destructive" title={title} role="alert">
      <Notice.Message>{message}</Notice.Message>
    </Notice>
  );
};
