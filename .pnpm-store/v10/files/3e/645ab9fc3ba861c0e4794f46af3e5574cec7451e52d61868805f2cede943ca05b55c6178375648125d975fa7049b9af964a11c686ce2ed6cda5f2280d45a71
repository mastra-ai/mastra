import { AssistantCloudAPI } from "./AssistantCloudAPI";

type AssistantCloudAuthTokensCreateResponse = {
  token: string;
};

export class AssistantCloudAuthTokens {
  constructor(private cloud: AssistantCloudAPI) {}

  public async create(): Promise<AssistantCloudAuthTokensCreateResponse> {
    return this.cloud.makeRequest("/auth/tokens", { method: "POST" });
  }
}
