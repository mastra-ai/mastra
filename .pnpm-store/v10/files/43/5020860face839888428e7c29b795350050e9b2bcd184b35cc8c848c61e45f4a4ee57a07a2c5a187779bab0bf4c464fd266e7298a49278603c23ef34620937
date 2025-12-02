export type AssistantCloudAuthStrategy = {
  readonly strategy: "anon" | "jwt" | "api-key";
  getAuthHeaders(): Promise<Record<string, string> | false>;
  readAuthHeaders(headers: Headers): void;
};

const getJwtExpiry = (jwt: string): number => {
  try {
    const parts = jwt.split(".");
    const bodyPart = parts[1];
    if (!bodyPart) {
      throw new Error("Invalid JWT format");
    }

    // Convert from Base64Url to Base64 and add padding if necessary
    let base64 = bodyPart.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) {
      base64 += "=";
    }

    // Decode the Base64 string and parse the payload
    const payload = atob(base64);
    const payloadObj = JSON.parse(payload);
    const exp = payloadObj.exp;

    if (!exp || typeof exp !== "number") {
      throw new Error('JWT does not contain a valid "exp" field');
    }

    // Convert expiration time to milliseconds
    return exp * 1000;
  } catch (error) {
    throw new Error("Unable to determine the token expiry: " + error);
  }
};

export class AssistantCloudJWTAuthStrategy
  implements AssistantCloudAuthStrategy
{
  public readonly strategy = "jwt";

  private cachedToken: string | null = null;
  private tokenExpiry: number | null = null;
  #authTokenCallback: () => Promise<string | null>;

  constructor(authTokenCallback: () => Promise<string | null>) {
    this.#authTokenCallback = authTokenCallback;
  }

  public async getAuthHeaders(): Promise<Record<string, string> | false> {
    const currentTime = Date.now();

    // Use cached token if it's valid for at least 30 more seconds
    if (
      this.cachedToken &&
      this.tokenExpiry &&
      this.tokenExpiry - currentTime > 30 * 1000
    ) {
      return { Authorization: `Bearer ${this.cachedToken}` };
    }

    // Fetch a new token via the callback
    const newToken = await this.#authTokenCallback();
    if (!newToken) return false;

    this.cachedToken = newToken;
    this.tokenExpiry = getJwtExpiry(newToken);

    return { Authorization: `Bearer ${newToken}` };
  }

  public readAuthHeaders(headers: Headers) {
    const authHeader = headers.get("Authorization");
    if (!authHeader) return;

    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new Error("Invalid auth header received");
    }

    this.cachedToken = token;
    this.tokenExpiry = getJwtExpiry(token);
  }
}

export class AssistantCloudAPIKeyAuthStrategy
  implements AssistantCloudAuthStrategy
{
  public readonly strategy = "api-key";

  #apiKey: string;
  #userId: string;
  #workspaceId: string;

  constructor(apiKey: string, userId: string, workspaceId: string) {
    this.#apiKey = apiKey;
    this.#userId = userId;
    this.#workspaceId = workspaceId;
  }

  public async getAuthHeaders(): Promise<Record<string, string>> {
    return {
      Authorization: `Bearer ${this.#apiKey}`,
      "Aui-User-Id": this.#userId,
      "Aui-Workspace-Id": this.#workspaceId,
    };
  }

  public readAuthHeaders() {
    // No operation needed for API key auth
  }
}

const AUI_REFRESH_TOKEN_NAME = "aui:refresh_token";

export class AssistantCloudAnonymousAuthStrategy
  implements AssistantCloudAuthStrategy
{
  public readonly strategy = "anon";

  private baseUrl: string;
  private jwtStrategy: AssistantCloudJWTAuthStrategy;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.jwtStrategy = new AssistantCloudJWTAuthStrategy(async () => {
      const currentTime = Date.now();
      const storedRefreshTokenJson = localStorage.getItem(
        AUI_REFRESH_TOKEN_NAME,
      );
      const storedRefreshToken = storedRefreshTokenJson
        ? (JSON.parse(storedRefreshTokenJson) as {
            token: string;
            expires_at: string;
          })
        : undefined;

      if (storedRefreshToken) {
        const refreshExpiry = new Date(storedRefreshToken.expires_at).getTime();
        if (refreshExpiry - currentTime > 30 * 1000) {
          const response = await fetch(
            `${this.baseUrl}/v1/auth/tokens/refresh`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refresh_token: storedRefreshToken.token }),
            },
          );

          if (response.ok) {
            const data = await response.json();
            const { access_token, refresh_token } = data;
            if (refresh_token) {
              localStorage.setItem(
                AUI_REFRESH_TOKEN_NAME,
                JSON.stringify(refresh_token),
              );
            }
            return access_token;
          }
        } else {
          localStorage.removeItem(AUI_REFRESH_TOKEN_NAME);
        }
      }

      // No valid refresh token; request a new anonymous token
      const response = await fetch(`${this.baseUrl}/v1/auth/tokens/anonymous`, {
        method: "POST",
      });

      if (!response.ok) return null;

      const data = await response.json();
      const { access_token, refresh_token } = data;

      if (!access_token || !refresh_token) return null;

      localStorage.setItem(
        AUI_REFRESH_TOKEN_NAME,
        JSON.stringify(refresh_token),
      );
      return access_token;
    });
  }

  public async getAuthHeaders(): Promise<Record<string, string> | false> {
    return this.jwtStrategy.getAuthHeaders();
  }

  public readAuthHeaders(headers: Headers): void {
    this.jwtStrategy.readAuthHeaders(headers);
  }
}
