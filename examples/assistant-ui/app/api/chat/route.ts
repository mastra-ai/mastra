import { openai } from '@ai-sdk/openai';
import { getEdgeRuntimeResponse } from '@assistant-ui/react/edge';

export const maxDuration = 30;

export const POST = async (request: Request) => {
  const requestData = await request.json();
  console.log(requestData);

  // return getExternalStoreRuntimeResponse({
  //   // options: {
  //   //   model: openai('gpt-4o'),
  //   // },
  //   requestData,
  //   abortSignal: request.signal,
  // });
};
