import { Context } from "../../../bundler/context.js";

export interface RedirectUriResponse {
  object: "redirect_uri";
  id: string;
  uri: string;
  default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CorsOriginResponse {
  object: "cors_origin";
  id: string;
  origin: string;
  created_at: string;
  updated_at: string;
}

export async function createRedirectURI(
  ctx: Context,
  apiKey: string,
  uri: string,
): Promise<{ modified: boolean }> {
  const response = await fetch(
    "https://api.workos.com/user_management/redirect_uris",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ uri }),
    },
  );

  if (!response.ok) {
    if (response.status === 422) {
      const errorText = await response.text();
      if (errorText.includes("already exists")) {
        // This redirect URI already exists.
        return { modified: false };
      }
    }

    const errorText = await response.text();
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Failed to create redirect URI: ${response.status} ${errorText}`,
    });
  }
  return { modified: true };
}

export async function createCORSOrigin(
  ctx: Context,
  apiKey: string,
  origin: string,
): Promise<{ modified: boolean }> {
  const response = await fetch(
    "https://api.workos.com/user_management/cors_origins",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ origin }),
    },
  );

  if (!response.ok) {
    if (response.status === 409) {
      const errorText = await response.text();
      if (
        errorText.includes("duplicate_cors_origin") ||
        errorText.includes("already exists")
      ) {
        // This CORS origin already exists.
        return { modified: false };
      }
    }

    const errorText = await response.text();
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Failed to create CORS origin: ${response.status} ${errorText}`,
    });
  }
  return { modified: true };
}
