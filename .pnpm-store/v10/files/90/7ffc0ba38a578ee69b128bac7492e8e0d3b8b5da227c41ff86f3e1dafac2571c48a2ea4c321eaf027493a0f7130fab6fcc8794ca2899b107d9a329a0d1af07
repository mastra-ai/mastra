// src/AssistantCloudAuthStrategy.tsx
var getJwtExpiry = (jwt) => {
  try {
    const parts = jwt.split(".");
    const bodyPart = parts[1];
    if (!bodyPart) {
      throw new Error("Invalid JWT format");
    }
    let base64 = bodyPart.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) {
      base64 += "=";
    }
    const payload = atob(base64);
    const payloadObj = JSON.parse(payload);
    const exp = payloadObj.exp;
    if (!exp || typeof exp !== "number") {
      throw new Error('JWT does not contain a valid "exp" field');
    }
    return exp * 1e3;
  } catch (error) {
    throw new Error("Unable to determine the token expiry: " + error);
  }
};
var AssistantCloudJWTAuthStrategy = class {
  strategy = "jwt";
  cachedToken = null;
  tokenExpiry = null;
  #authTokenCallback;
  constructor(authTokenCallback) {
    this.#authTokenCallback = authTokenCallback;
  }
  async getAuthHeaders() {
    const currentTime = Date.now();
    if (this.cachedToken && this.tokenExpiry && this.tokenExpiry - currentTime > 30 * 1e3) {
      return { Authorization: `Bearer ${this.cachedToken}` };
    }
    const newToken = await this.#authTokenCallback();
    if (!newToken) return false;
    this.cachedToken = newToken;
    this.tokenExpiry = getJwtExpiry(newToken);
    return { Authorization: `Bearer ${newToken}` };
  }
  readAuthHeaders(headers) {
    const authHeader = headers.get("Authorization");
    if (!authHeader) return;
    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new Error("Invalid auth header received");
    }
    this.cachedToken = token;
    this.tokenExpiry = getJwtExpiry(token);
  }
};
var AssistantCloudAPIKeyAuthStrategy = class {
  strategy = "api-key";
  #apiKey;
  #userId;
  #workspaceId;
  constructor(apiKey, userId, workspaceId) {
    this.#apiKey = apiKey;
    this.#userId = userId;
    this.#workspaceId = workspaceId;
  }
  async getAuthHeaders() {
    return {
      Authorization: `Bearer ${this.#apiKey}`,
      "Aui-User-Id": this.#userId,
      "Aui-Workspace-Id": this.#workspaceId
    };
  }
  readAuthHeaders() {
  }
};
var AUI_REFRESH_TOKEN_NAME = "aui:refresh_token";
var AssistantCloudAnonymousAuthStrategy = class {
  strategy = "anon";
  baseUrl;
  jwtStrategy;
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.jwtStrategy = new AssistantCloudJWTAuthStrategy(async () => {
      const currentTime = Date.now();
      const storedRefreshTokenJson = localStorage.getItem(
        AUI_REFRESH_TOKEN_NAME
      );
      const storedRefreshToken = storedRefreshTokenJson ? JSON.parse(storedRefreshTokenJson) : void 0;
      if (storedRefreshToken) {
        const refreshExpiry = new Date(storedRefreshToken.expires_at).getTime();
        if (refreshExpiry - currentTime > 30 * 1e3) {
          const response2 = await fetch(
            `${this.baseUrl}/v1/auth/tokens/refresh`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refresh_token: storedRefreshToken.token })
            }
          );
          if (response2.ok) {
            const data2 = await response2.json();
            const { access_token: access_token2, refresh_token: refresh_token2 } = data2;
            if (refresh_token2) {
              localStorage.setItem(
                AUI_REFRESH_TOKEN_NAME,
                JSON.stringify(refresh_token2)
              );
            }
            return access_token2;
          }
        } else {
          localStorage.removeItem(AUI_REFRESH_TOKEN_NAME);
        }
      }
      const response = await fetch(`${this.baseUrl}/v1/auth/tokens/anonymous`, {
        method: "POST"
      });
      if (!response.ok) return null;
      const data = await response.json();
      const { access_token, refresh_token } = data;
      if (!access_token || !refresh_token) return null;
      localStorage.setItem(
        AUI_REFRESH_TOKEN_NAME,
        JSON.stringify(refresh_token)
      );
      return access_token;
    });
  }
  async getAuthHeaders() {
    return this.jwtStrategy.getAuthHeaders();
  }
  readAuthHeaders(headers) {
    this.jwtStrategy.readAuthHeaders(headers);
  }
};
export {
  AssistantCloudAPIKeyAuthStrategy,
  AssistantCloudAnonymousAuthStrategy,
  AssistantCloudJWTAuthStrategy
};
//# sourceMappingURL=AssistantCloudAuthStrategy.js.map