import { convertProtocolToWs } from "./helpers";
import { isBrowser, isBun, isNode, NODE_VERSION, BUN_VERSION, BROWSER_AGENT } from "./runtime";
import { version } from "./version";
import type { DefaultNamespaceOptions, DefaultClientOptions } from "./types";

const getAgent = () => {
  if (isNode()) {
    return `node/${NODE_VERSION}`;
  } else if (isBun()) {
    return `bun/${BUN_VERSION}`;
  } else if (isBrowser()) {
    return `javascript ${BROWSER_AGENT}`;
  } else {
    return `unknown`;
  }
};

export const DEFAULT_HEADERS = {
  "Content-Type": `application/json`,
  "X-Client-Info": `@deepgram/sdk; ${isBrowser() ? "browser" : "server"}; v${version}`,
  "User-Agent": `@deepgram/sdk/${version} ${getAgent()}`,
};

export const DEFAULT_URL = "https://api.deepgram.com";
export const DEFAULT_AGENT_URL = "wss://agent.deepgram.com";

export const DEFAULT_GLOBAL_OPTIONS: Partial<DefaultNamespaceOptions> = {
  fetch: { options: { url: DEFAULT_URL, headers: DEFAULT_HEADERS } },
  websocket: {
    options: { url: convertProtocolToWs(DEFAULT_URL), _nodeOnlyHeaders: DEFAULT_HEADERS },
  },
};

export const DEFAULT_AGENT_OPTIONS: Partial<DefaultNamespaceOptions> = {
  fetch: { options: { url: DEFAULT_URL, headers: DEFAULT_HEADERS } },
  websocket: {
    options: { url: DEFAULT_AGENT_URL, _nodeOnlyHeaders: DEFAULT_HEADERS },
  },
};

export const DEFAULT_OPTIONS: DefaultClientOptions = {
  global: DEFAULT_GLOBAL_OPTIONS,
  agent: DEFAULT_AGENT_OPTIONS,
};

export enum SOCKET_STATES {
  connecting = 0,
  open = 1,
  closing = 2,
  closed = 3,
}

export enum CONNECTION_STATE {
  Connecting = "connecting",
  Open = "open",
  Closing = "closing",
  Closed = "closed",
}
