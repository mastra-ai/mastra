const MAX_RFB_BYTES = 1024 * 1024;

type HandshakeStage =
  | 'server-version'
  | 'client-version'
  | 'server-security'
  | 'client-security'
  | 'server-challenge'
  | 'client-response'
  | 'server-result'
  | 'client-init'
  | 'server-init'
  | 'normal';

export class RfbProtocolError extends Error {}
export class RfbTooLargeError extends RfbProtocolError {}

/** Stateful RFB parser ported from Platform's workspace-proxy view filter (`0fe92d2f84`). */
export class RfbWatchFilter {
  #stage: HandshakeStage = 'server-version';
  #serverBuffer = Buffer.alloc(0);
  #clientBuffer = Buffer.alloc(0);
  #securityTypes: number[] = [];
  #securityType = 0;

  constructor(private readonly controlAllowed: () => Promise<boolean>) {}

  observeServer(payload: Buffer): void {
    if (this.#stage === 'normal') return;
    this.#serverBuffer = Buffer.concat([this.#serverBuffer, payload]);
    if (this.#serverBuffer.length > MAX_RFB_BYTES) throw new RfbTooLargeError('RFB handshake too large');
    while (true) {
      if (this.#stage === 'server-version') {
        if (this.#serverBuffer.length < 12) return;
        if (this.#takeServer(12).toString('ascii') !== 'RFB 003.008\n') throw new RfbProtocolError('Unsupported RFB version');
        this.#stage = 'client-version';
      } else if (this.#stage === 'server-security') {
        if (this.#serverBuffer.length < 1) return;
        const count = this.#serverBuffer[0]!;
        if (count === 0) throw new RfbProtocolError('RFB security negotiation failed');
        if (this.#serverBuffer.length < count + 1) return;
        this.#securityTypes = [...this.#takeServer(count + 1).subarray(1)];
        this.#stage = 'client-security';
      } else if (this.#stage === 'server-challenge') {
        if (this.#serverBuffer.length < 16) return;
        this.#takeServer(16);
        this.#stage = 'client-response';
      } else if (this.#stage === 'server-result') {
        if (this.#serverBuffer.length < 4) return;
        if (this.#takeServer(4).readUInt32BE() !== 0) throw new RfbProtocolError('RFB authentication failed');
        this.#stage = 'client-init';
      } else if (this.#stage === 'server-init') {
        if (this.#serverBuffer.length < 24) return;
        const nameLength = this.#serverBuffer.readUInt32BE(20);
        if (nameLength > MAX_RFB_BYTES) throw new RfbTooLargeError('RFB server name too large');
        if (this.#serverBuffer.length < 24 + nameLength) return;
        this.#takeServer(24 + nameLength);
        this.#serverBuffer = Buffer.alloc(0);
        this.#stage = 'normal';
      } else return;
    }
  }

  async filterClient(payload: Buffer): Promise<Buffer[]> {
    this.#clientBuffer = Buffer.concat([this.#clientBuffer, payload]);
    if (this.#clientBuffer.length > MAX_RFB_BYTES) throw new RfbTooLargeError('RFB client buffer too large');
    const output: Buffer[] = [];
    while (true) {
      if (this.#stage === 'client-version') {
        if (this.#clientBuffer.length < 12) break;
        const version = this.#takeClient(12);
        if (version.toString('ascii') !== 'RFB 003.008\n') throw new RfbProtocolError('Unsupported RFB client version');
        output.push(version);
        this.#stage = 'server-security';
      } else if (this.#stage === 'client-security') {
        if (this.#clientBuffer.length < 1) break;
        const choice = this.#takeClient(1);
        this.#securityType = choice[0]!;
        if (!this.#securityTypes.includes(this.#securityType) || ![1, 2].includes(this.#securityType)) {
          throw new RfbProtocolError('Unsupported RFB security type');
        }
        output.push(choice);
        this.#stage = this.#securityType === 2 ? 'server-challenge' : 'server-result';
      } else if (this.#stage === 'client-response') {
        if (this.#clientBuffer.length < 16) break;
        output.push(this.#takeClient(16));
        this.#stage = 'server-result';
      } else if (this.#stage === 'client-init') {
        if (this.#clientBuffer.length < 1) break;
        output.push(this.#takeClient(1));
        this.#stage = 'server-init';
      } else if (this.#stage === 'normal') {
        const length = this.#normalMessageLength();
        if (length === null || this.#clientBuffer.length < length) break;
        const message = this.#takeClient(length);
        const type = message[0]!;
        const readOnly = type === 0 || type === 2 || type === 3 || type === 150 || type === 248;
        if (readOnly || (await this.controlAllowed())) output.push(message);
      } else break;
    }
    return output;
  }

  #normalMessageLength(): number | null {
    if (this.#clientBuffer.length < 1) return null;
    const type = this.#clientBuffer[0]!;
    if (type === 0) return 20;
    if (type === 2) {
      if (this.#clientBuffer.length < 4) return null;
      return this.#bounded(4 + 4 * this.#clientBuffer.readUInt16BE(2));
    }
    if (type === 3) return 10;
    if (type === 4) return 8;
    if (type === 5) return 6;
    if (type === 6) {
      if (this.#clientBuffer.length < 8) return null;
      const length = this.#clientBuffer.readInt32BE(4);
      if (length < 0) throw new RfbProtocolError('Extended clipboard is unsupported');
      return this.#bounded(8 + length);
    }
    if (type === 150) return 10;
    if (type === 248) {
      if (this.#clientBuffer.length < 9) return null;
      return this.#bounded(9 + this.#clientBuffer[8]!);
    }
    if (type === 251) {
      if (this.#clientBuffer.length < 8) return null;
      return this.#bounded(8 + 16 * this.#clientBuffer[6]!);
    }
    if (type === 255) {
      if (this.#clientBuffer.length < 2) return null;
      if (this.#clientBuffer[1] !== 0) throw new RfbProtocolError('Unsupported QEMU message');
      return 12;
    }
    throw new RfbProtocolError('Unsupported RFB client message');
  }

  #bounded(length: number): number {
    if (length > MAX_RFB_BYTES) throw new RfbTooLargeError('RFB message too large');
    return length;
  }

  #takeServer(length: number): Buffer {
    const value = this.#serverBuffer.subarray(0, length);
    this.#serverBuffer = this.#serverBuffer.subarray(length);
    return value;
  }

  #takeClient(length: number): Buffer {
    const value = this.#clientBuffer.subarray(0, length);
    this.#clientBuffer = this.#clientBuffer.subarray(length);
    return value;
  }
}
