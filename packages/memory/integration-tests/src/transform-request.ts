export function transformRequest({ url, body }: { url: string; body: unknown }): { url: string; body: unknown } {
  let stringifiedBody = JSON.stringify(body);
  stringifiedBody = stringifiedBody.replaceAll(/\\"createdAt\\":\\"[^"]+\\"/g, '\\"createdAt\\":\\"REDACTED\\"');
  stringifiedBody = stringifiedBody.replaceAll(/\\"toolCallId\\":\\"[^"]+\\"/g, '\\"toolCallId\\":\\"REDACTED\\"');
  stringifiedBody = stringifiedBody.replaceAll(/\\"id\\":\\"[^"]+\\"/g, '\\"id\\":\\"REDACTED\\"');
  stringifiedBody = stringifiedBody.replaceAll(/\d+ms/g, `REDACTED`);

  return {
    url,
    body: JSON.parse(stringifiedBody),
  };
}
