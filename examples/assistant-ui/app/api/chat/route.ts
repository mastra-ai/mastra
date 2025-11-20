export const maxDuration = 30;

export const POST = async (request: Request) => {
  const requestData = await request.json();
  console.log(requestData);

  // return getExternalStoreRuntimeResponse({
  //   // options: {
  //   //   model: openai('gpt-5.1'),
  //   // },
  //   requestData,
  //   abortSignal: request.signal,
  // });
};
