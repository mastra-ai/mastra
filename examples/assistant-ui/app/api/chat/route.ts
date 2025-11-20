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
