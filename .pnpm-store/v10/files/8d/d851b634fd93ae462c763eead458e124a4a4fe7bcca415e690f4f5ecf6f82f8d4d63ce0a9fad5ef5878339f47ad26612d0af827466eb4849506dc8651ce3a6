export interface WebSocketLike {
  readonly CONNECTING: number
  readonly OPEN: number
  readonly CLOSING: number
  readonly CLOSED: number
  readonly readyState: number
  readonly url: string
  readonly protocol: string

  close(code?: number, reason?: string): void
  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void

  onopen: ((this: any, ev: Event) => any) | null
  onmessage: ((this: any, ev: MessageEvent) => any) | null
  onclose: ((this: any, ev: CloseEvent) => any) | null
  onerror: ((this: any, ev: Event) => any) | null

  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void

  // Add additional properties that may exist on WebSocket implementations
  binaryType?: string
  bufferedAmount?: number
  extensions?: string
  dispatchEvent?: (event: Event) => boolean
}

export interface WebSocketEnvironment {
  type: 'native' | 'ws' | 'cloudflare' | 'unsupported'
  constructor?: any
  error?: string
  workaround?: string
}

export class WebSocketFactory {
  private static detectEnvironment(): WebSocketEnvironment {
    if (typeof WebSocket !== 'undefined') {
      return { type: 'native', constructor: WebSocket }
    }

    if (typeof globalThis !== 'undefined' && typeof (globalThis as any).WebSocket !== 'undefined') {
      return { type: 'native', constructor: (globalThis as any).WebSocket }
    }

    if (typeof global !== 'undefined' && typeof (global as any).WebSocket !== 'undefined') {
      return { type: 'native', constructor: (global as any).WebSocket }
    }

    if (
      typeof globalThis !== 'undefined' &&
      typeof (globalThis as any).WebSocketPair !== 'undefined' &&
      typeof globalThis.WebSocket === 'undefined'
    ) {
      return {
        type: 'cloudflare',
        error:
          'Cloudflare Workers detected. WebSocket clients are not supported in Cloudflare Workers.',
        workaround:
          'Use Cloudflare Workers WebSocket API for server-side WebSocket handling, or deploy to a different runtime.',
      }
    }

    if (
      (typeof globalThis !== 'undefined' && (globalThis as any).EdgeRuntime) ||
      (typeof navigator !== 'undefined' && navigator.userAgent?.includes('Vercel-Edge'))
    ) {
      return {
        type: 'unsupported',
        error:
          'Edge runtime detected (Vercel Edge/Netlify Edge). WebSockets are not supported in edge functions.',
        workaround:
          'Use serverless functions or a different deployment target for WebSocket functionality.',
      }
    }

    if (typeof process !== 'undefined') {
      // Use dynamic property access to avoid Next.js Edge Runtime static analysis warnings
      const processVersions = (process as any)['versions']
      if (processVersions && processVersions['node']) {
        // Remove 'v' prefix if present and parse the major version
        const versionString = processVersions['node']
        const nodeVersion = parseInt(versionString.replace(/^v/, '').split('.')[0])

        // Node.js 22+ should have native WebSocket
        if (nodeVersion >= 22) {
          // Check if native WebSocket is available (should be in Node.js 22+)
          if (typeof globalThis.WebSocket !== 'undefined') {
            return { type: 'native', constructor: globalThis.WebSocket }
          }
          // If not available, user needs to provide it
          return {
            type: 'unsupported',
            error: `Node.js ${nodeVersion} detected but native WebSocket not found.`,
            workaround: 'Provide a WebSocket implementation via the transport option.',
          }
        }

        // Node.js < 22 doesn't have native WebSocket
        return {
          type: 'unsupported',
          error: `Node.js ${nodeVersion} detected without native WebSocket support.`,
          workaround:
            'For Node.js < 22, install "ws" package and provide it via the transport option:\n' +
            'import ws from "ws"\n' +
            'new RealtimeClient(url, { transport: ws })',
        }
      }
    }

    return {
      type: 'unsupported',
      error: 'Unknown JavaScript runtime without WebSocket support.',
      workaround:
        "Ensure you're running in a supported environment (browser, Node.js, Deno) or provide a custom WebSocket implementation.",
    }
  }

  public static getWebSocketConstructor(): typeof WebSocket {
    const env = this.detectEnvironment()
    if (env.constructor) {
      return env.constructor
    }
    let errorMessage = env.error || 'WebSocket not supported in this environment.'
    if (env.workaround) {
      errorMessage += `\n\nSuggested solution: ${env.workaround}`
    }
    throw new Error(errorMessage)
  }

  public static createWebSocket(url: string | URL, protocols?: string | string[]): WebSocketLike {
    const WS = this.getWebSocketConstructor()
    return new WS(url, protocols)
  }

  public static isWebSocketSupported(): boolean {
    try {
      const env = this.detectEnvironment()
      return env.type === 'native' || env.type === 'ws'
    } catch {
      return false
    }
  }
}

export default WebSocketFactory
