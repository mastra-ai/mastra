export async function createR2TemporaryCredentials(unsigned: string, secretAccessKey: string) {
  const encoder = new TextEncoder();
  const hmacKey = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(secretAccessKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = Buffer.from(
    await globalThis.crypto.subtle.sign('HMAC', hmacKey, encoder.encode(unsigned)),
  ).toString('base64url');
  const jwt = `${unsigned}.${signature}`;

  return {
    jwt,
    secretAccessKey: Buffer.from(await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(jwt))).toString('hex'),
  };
}
