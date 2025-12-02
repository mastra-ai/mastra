// src/AssistantCloud.tsx
import { AssistantCloudAPI } from "./AssistantCloudAPI.js";
import { AssistantCloudAuthTokens } from "./AssistantCloudAuthTokens.js";
import { AssistantCloudRuns } from "./AssistantCloudRuns.js";
import { AssistantCloudThreads } from "./AssistantCloudThreads.js";
import { AssistantCloudFiles } from "./AssistantCloudFiles.js";
var AssistantCloud = class {
  threads;
  auth;
  runs;
  files;
  constructor(config) {
    const api = new AssistantCloudAPI(config);
    this.threads = new AssistantCloudThreads(api);
    this.auth = {
      tokens: new AssistantCloudAuthTokens(api)
    };
    this.runs = new AssistantCloudRuns(api);
    this.files = new AssistantCloudFiles(api);
  }
};
export {
  AssistantCloud
};
//# sourceMappingURL=AssistantCloud.js.map