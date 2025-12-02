"use strict";
export async function createRedirectURI(ctx, apiKey, uri) {
  const response = await fetch(
    "https://api.workos.com/user_management/redirect_uris",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ uri })
    }
  );
  if (!response.ok) {
    if (response.status === 422) {
      const errorText2 = await response.text();
      if (errorText2.includes("already exists")) {
        return { modified: false };
      }
    }
    const errorText = await response.text();
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Failed to create redirect URI: ${response.status} ${errorText}`
    });
  }
  return { modified: true };
}
export async function createCORSOrigin(ctx, apiKey, origin) {
  const response = await fetch(
    "https://api.workos.com/user_management/cors_origins",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ origin })
    }
  );
  if (!response.ok) {
    if (response.status === 409) {
      const errorText2 = await response.text();
      if (errorText2.includes("duplicate_cors_origin") || errorText2.includes("already exists")) {
        return { modified: false };
      }
    }
    const errorText = await response.text();
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Failed to create CORS origin: ${response.status} ${errorText}`
    });
  }
  return { modified: true };
}
//# sourceMappingURL=environmentApi.js.map
