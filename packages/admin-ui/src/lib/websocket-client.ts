type MessageHandler = (event: WebSocketEvent) => void;
type ConnectionHandler = () => void;

export interface WebSocketClientConfig {
  url: string;
  getToken: () => Promise<string | null>;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export interface WebSocketEvent {
  type: string;
  payload: unknown;
}

export interface BuildLogEvent {
  type: 'build:log';
  payload: {
    buildId: string;
    line: string;
    timestamp: string;
    level: 'info' | 'warn' | 'error';
  };
}

export interface BuildStatusEvent {
  type: 'build:status';
  payload: {
    buildId: string;
    status: string;
    message?: string;
  };
}

export interface ServerLogEvent {
  type: 'server:log';
  payload: {
    serverId: string;
    id?: string;
    line: string;
    timestamp: string;
    stream: 'stdout' | 'stderr';
  };
}

export interface ServerHealthEvent {
  type: 'server:health';
  payload: {
    serverId: string;
    status: string;
    lastCheck: string;
    details?: {
      memoryUsageMb?: number;
      cpuPercent?: number;
      uptime?: number;
    };
  };
}

export interface DeploymentStatusEvent {
  type: 'deployment:status';
  payload: {
    deploymentId: string;
    status: string;
    publicUrl?: string;
  };
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketClientConfig>;
  private subscriptions = new Map<string, Set<MessageHandler>>();
  private connectionHandlers = new Set<ConnectionHandler>();
  private disconnectionHandlers = new Set<ConnectionHandler>();
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isManualDisconnect = false;

  constructor(config: WebSocketClientConfig) {
    this.config = {
      reconnectDelay: 1000,
      maxReconnectAttempts: 10,
      ...config,
    };
  }

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    const token = await this.config.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    this.isManualDisconnect = false;

    const url = new URL(this.config.url);
    url.searchParams.set('token', token);

    this.ws = new WebSocket(url.toString());

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.connectionHandlers.forEach(handler => handler());
    };

    this.ws.onmessage = event => {
      try {
        const message = JSON.parse(event.data) as { type: string; payload: unknown };

        if (message.type === 'connected') {
          this.resubscribeAll();
          return;
        }

        const channel = this.extractChannel(message);
        if (channel) {
          const handlers = this.subscriptions.get(channel);
          handlers?.forEach(handler => handler(message as WebSocketEvent));
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    this.ws.onclose = () => {
      this.disconnectionHandlers.forEach(handler => handler());
      if (!this.isManualDisconnect) {
        this.attemptReconnect();
      }
    };

    this.ws.onerror = error => {
      console.error('WebSocket error:', error);
    };
  }

  private extractChannel(message: { type: string; payload: unknown }): string | null {
    const payload = message.payload as Record<string, string>;
    switch (message.type) {
      case 'build:log':
      case 'build:status':
        return `build:${payload.buildId}`;
      case 'server:log':
      case 'server:health':
        return `server:${payload.serverId}`;
      case 'deployment:status':
        return `deployment:${payload.deploymentId}`;
      default:
        return null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch(err => {
        console.error('Reconnection failed:', err);
      });
    }, delay);
  }

  private resubscribeAll(): void {
    for (const channel of this.subscriptions.keys()) {
      this.sendSubscribe(channel);
    }
  }

  private sendSubscribe(channel: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', payload: { channel } }));
    }
  }

  private sendUnsubscribe(channel: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'unsubscribe', payload: { channel } }));
    }
  }

  subscribe(channel: string, handler: MessageHandler): () => void {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      this.sendSubscribe(channel);
    }
    this.subscriptions.get(channel)!.add(handler);

    return () => {
      const handlers = this.subscriptions.get(channel);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.subscriptions.delete(channel);
          this.sendUnsubscribe(channel);
        }
      }
    };
  }

  onConnect(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  onDisconnect(handler: ConnectionHandler): () => void {
    this.disconnectionHandlers.add(handler);
    return () => this.disconnectionHandlers.delete(handler);
  }

  disconnect(): void {
    this.isManualDisconnect = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.ws?.close();
    this.ws = null;
    this.subscriptions.clear();
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
