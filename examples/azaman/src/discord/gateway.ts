import WebSocket from 'ws';
import { handleMessage } from './message-handler';
import { DiscordMessage } from './types';

interface GatewayPayload {
  op: number;
  d: {
    heartbeat_interval?: number;
    session_id?: string;
    resume_gateway_url?: string;
    // Message event data
    id?: string;
    channel_id?: string;
    content?: string;
    mentions?: Array<{ id: string; username: string }>;
    [key: string]: unknown;
  };
  s?: number;
  t?: string;
}

export class DiscordGateway {
  private ws: WebSocket | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private sequence: number | null = null;
  private sessionId: string | null = null;
  private resumeGatewayUrl: string | null = null;

  constructor(private token: string) {}

  connect() {
    // Connect to Discord Gateway
    this.ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');

    this.ws.on('open', () => {
      console.log('Connected to Discord Gateway');
    });

    this.ws.on('message', (data: string) => {
      const payload: GatewayPayload = JSON.parse(data);
      this.handlePayload(payload);
    });

    this.ws.on('close', (code: number) => {
      console.log(`Gateway connection closed with code ${code}`);
      this.cleanup();

      // Attempt to resume or reconnect after a delay
      setTimeout(() => {
        if (this.sessionId && this.resumeGatewayUrl) {
          this.resume();
        } else {
          this.connect();
        }
      }, 5000);
    });

    this.ws.on('error', (error: Error) => {
      console.error('Gateway error:', error);
    });
  }

  private handlePayload(payload: GatewayPayload) {
    // Update sequence number if present
    if (payload.s) {
      this.sequence = payload.s;
    }

    switch (payload.op) {
      case 10: // Hello
        if (payload.d.heartbeat_interval) {
          // Start heartbeating
          this.startHeartbeat(payload.d.heartbeat_interval);
          // Identify with Discord
          this.identify();
        }
        break;

      case 11: // Heartbeat ACK
        console.log('Heartbeat acknowledged');
        break;

      case 0: // Dispatch
        this.handleDispatch(payload);
        break;

      case 7: // Reconnect
        this.cleanup();
        this.connect();
        break;

      case 9: // Invalid Session
        this.sessionId = null;
        this.cleanup();
        setTimeout(() => this.connect(), 5000);
        break;
    }
  }

  private handleDispatch(payload: GatewayPayload) {
    switch (payload.t) {
      case 'READY':
        if (payload.d.session_id) {
          this.sessionId = payload.d.session_id;
        }
        if (payload.d.resume_gateway_url) {
          this.resumeGatewayUrl = payload.d.resume_gateway_url;
        }
        console.log('Gateway ready');
        break;

      case 'MESSAGE_CREATE':
        // Ensure message has required fields before handling
        if (
          payload.d.id &&
          payload.d.channel_id &&
          payload.d.content &&
          Array.isArray(payload.d.mentions)
        ) {
          handleMessage(payload.d as DiscordMessage);
        }
        break;
    }
  }

  private identify() {
    if (!this.ws) return;

    this.ws.send(JSON.stringify({
      op: 2, // Identify
      d: {
        token: this.token,
        intents: 1 << 0 | // GUILDS
                 1 << 9 | // GUILD_MESSAGES
                 1 << 15, // MESSAGE_CONTENT
        properties: {
          os: 'linux',
          browser: 'mastra',
          device: 'mastra'
        }
      }
    }));
  }

  private resume() {
    if (!this.ws || !this.sessionId) return;

    this.ws.send(JSON.stringify({
      op: 6, // Resume
      d: {
        token: this.token,
        session_id: this.sessionId,
        seq: this.sequence
      }
    }));
  }

  private startHeartbeat(interval: number) {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (!this.ws) return;

      this.ws.send(JSON.stringify({
        op: 1, // Heartbeat
        d: this.sequence
      }));
    }, interval);
  }

  private cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
  }

  disconnect() {
    this.cleanup();
  }
}

// Initialize and export gateway instance
export const gateway = new DiscordGateway(process.env.DISCORD_TOKEN!);
