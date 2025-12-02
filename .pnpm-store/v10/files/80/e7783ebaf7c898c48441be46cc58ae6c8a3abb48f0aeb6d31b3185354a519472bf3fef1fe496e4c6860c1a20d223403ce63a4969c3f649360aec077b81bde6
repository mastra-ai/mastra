// src/AssistantCloudAPI.tsx
import {
  AssistantCloudJWTAuthStrategy,
  AssistantCloudAPIKeyAuthStrategy,
  AssistantCloudAnonymousAuthStrategy
} from "./AssistantCloudAuthStrategy.js";
var CloudAPIError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "APIError";
  }
};
var AssistantCloudAPI = class {
  _auth;
  _baseUrl;
  constructor(config) {
    if ("authToken" in config) {
      this._baseUrl = config.baseUrl;
      this._auth = new AssistantCloudJWTAuthStrategy(config.authToken);
    } else if ("apiKey" in config) {
      this._baseUrl = "https://backend.assistant-api.com";
      this._auth = new AssistantCloudAPIKeyAuthStrategy(
        config.apiKey,
        config.userId,
        config.workspaceId
      );
    } else if ("anonymous" in config) {
      this._baseUrl = config.baseUrl;
      this._auth = new AssistantCloudAnonymousAuthStrategy(config.baseUrl);
    } else {
      throw new Error(
        "Invalid configuration: Must provide authToken, apiKey, or anonymous configuration"
      );
    }
  }
  async initializeAuth() {
    return !!this._auth.getAuthHeaders();
  }
  async makeRawRequest(endpoint, options = {}) {
    const authHeaders = await this._auth.getAuthHeaders();
    if (!authHeaders) throw new Error("Authorization failed");
    const headers = {
      ...authHeaders,
      ...options.headers,
      "Content-Type": "application/json"
    };
    const queryParams = new URLSearchParams();
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value === false) continue;
        if (value === true) {
          queryParams.set(key, "true");
        } else {
          queryParams.set(key, value.toString());
        }
      }
    }
    const url = new URL(`${this._baseUrl}/v1${endpoint}`);
    url.search = queryParams.toString();
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : null
    });
    this._auth.readAuthHeaders(response.headers);
    if (!response.ok) {
      const text = await response.text();
      try {
        const body = JSON.parse(text);
        throw new CloudAPIError(body.message);
      } catch {
        throw new Error(
          `Request failed with status ${response.status}, ${text}`
        );
      }
    }
    return response;
  }
  async makeRequest(endpoint, options = {}) {
    const response = await this.makeRawRequest(endpoint, options);
    return response.json();
  }
};
export {
  AssistantCloudAPI
};
//# sourceMappingURL=AssistantCloudAPI.js.map