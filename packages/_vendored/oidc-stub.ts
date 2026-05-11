export function getContext() {
  return {
    headers: {},
  };
}

export async function getVercelOidcToken(): Promise<string> {
  if (process.env.VERCEL_OIDC_TOKEN) {
    return process.env.VERCEL_OIDC_TOKEN ?? '';
  }

  throw new Error('@vercel/oidc is not available in the vendored @internal AI packages. Provide an API key instead.');
}
