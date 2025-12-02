import * as http from 'http'
import * as https from 'https'
import { URL } from 'url'

declare class HttpProxyAgent extends http.Agent {
  constructor(options: HttpProxyAgentOptions)
}

interface HttpProxyAgentOptions extends http.AgentOptions {
  proxy: string | URL,
  proxyRequestOptions?: ProxyAgentRequestOptions
}

declare class HttpsProxyAgent extends https.Agent {
  constructor(options: HttpsProxyAgentOptions)
}

interface HttpsProxyAgentOptions extends https.AgentOptions {
  proxy: string | URL,
  proxyRequestOptions?: ProxyAgentRequestOptions
}

interface ProxyAgentRequestOptions {
  ca?: string[],
  headers?: Object,
  rejectUnauthorized?: boolean
}

export {
  HttpProxyAgent,
  HttpProxyAgentOptions,
  HttpsProxyAgent,
  HttpsProxyAgentOptions,
  ProxyAgentRequestOptions,
}
