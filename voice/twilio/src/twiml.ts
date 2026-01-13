/**
 * TwiML generation helpers for Twilio Voice
 *
 * TwiML (Twilio Markup Language) is used to tell Twilio how to handle
 * incoming voice calls.
 */

/**
 * Options for generating Media Streams TwiML
 */
export interface StreamTwiMLOptions {
  /** WebSocket URL for the Media Stream */
  url: string;
  /** Audio encoding format (default: 'audio/x-mulaw') */
  encoding?: 'audio/x-mulaw' | 'audio/x-alaw';
  /** Sample rate (default: 8000) */
  sampleRate?: number;
  /** Custom parameters to pass to the stream */
  parameters?: Record<string, string>;
}

/**
 * Options for Say TwiML
 */
export interface SayTwiMLOptions {
  /** Text to speak */
  text: string;
  /** Voice to use */
  voice?: 'alice' | 'man' | 'woman' | string;
  /** Language */
  language?: string;
  /** Number of times to loop (0 = infinite) */
  loop?: number;
}

/**
 * Generate TwiML to connect a call to a Media Stream WebSocket
 *
 * @param options - Stream configuration options
 * @returns TwiML XML string
 *
 * @example
 * ```typescript
 * app.post('/incoming-call', (c) => {
 *   const twiml = generateTwiML({
 *     url: `wss://${c.req.header('host')}/media-stream`,
 *   });
 *   return c.text(twiml, 200, { 'Content-Type': 'text/xml' });
 * });
 * ```
 */
export function generateTwiML(options: StreamTwiMLOptions): string {
  const { url, encoding = 'audio/x-mulaw', sampleRate = 8000, parameters = {} } = options;

  const parameterElements = Object.entries(parameters)
    .map(([name, value]) => `      <Parameter name="${escapeXml(name)}" value="${escapeXml(value)}" />`)
    .join('\n');

  const parameterSection = parameterElements ? `\n${parameterElements}\n    ` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${escapeXml(url)}">
      <Parameter name="encoding" value="${encoding}" />
      <Parameter name="sampleRate" value="${sampleRate}" />${parameterSection}
    </Stream>
  </Connect>
</Response>`;
}

/**
 * TwiML builder for more complex scenarios
 *
 * @example
 * ```typescript
 * const response = twiml
 *   .say({ text: 'Please wait while we connect you.' })
 *   .stream({ url: 'wss://example.com/media' })
 *   .build();
 * ```
 */
export const twiml = {
  /**
   * Create a new TwiML response builder
   */
  response(): TwiMLBuilder {
    return new TwiMLBuilder();
  },

  /**
   * Generate a simple Media Stream TwiML
   */
  stream(options: StreamTwiMLOptions): string {
    return generateTwiML(options);
  },

  /**
   * Generate a Say TwiML
   */
  say(options: SayTwiMLOptions): string {
    const { text, voice, language, loop } = options;
    const attrs: string[] = [];

    if (voice) attrs.push(`voice="${escapeXml(voice)}"`);
    if (language) attrs.push(`language="${escapeXml(language)}"`);
    if (loop !== undefined) attrs.push(`loop="${loop}"`);

    const attrString = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say${attrString}>${escapeXml(text)}</Say>
</Response>`;
  },

  /**
   * Generate a Reject TwiML
   */
  reject(reason: 'rejected' | 'busy' = 'rejected'): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Reject reason="${reason}" />
</Response>`;
  },

  /**
   * Generate a Hangup TwiML
   */
  hangup(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup />
</Response>`;
  },
};

/**
 * TwiML response builder for complex scenarios
 */
class TwiMLBuilder {
  private elements: string[] = [];

  /**
   * Add a Say element
   */
  say(options: SayTwiMLOptions): this {
    const { text, voice, language, loop } = options;
    const attrs: string[] = [];

    if (voice) attrs.push(`voice="${escapeXml(voice)}"`);
    if (language) attrs.push(`language="${escapeXml(language)}"`);
    if (loop !== undefined) attrs.push(`loop="${loop}"`);

    const attrString = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
    this.elements.push(`  <Say${attrString}>${escapeXml(text)}</Say>`);
    return this;
  }

  /**
   * Add a Stream element (inside Connect)
   */
  stream(options: StreamTwiMLOptions): this {
    const { url, encoding = 'audio/x-mulaw', sampleRate = 8000, parameters = {} } = options;

    const parameterElements = [
      `      <Parameter name="encoding" value="${encoding}" />`,
      `      <Parameter name="sampleRate" value="${sampleRate}" />`,
      ...Object.entries(parameters).map(
        ([name, value]) => `      <Parameter name="${escapeXml(name)}" value="${escapeXml(value)}" />`,
      ),
    ].join('\n');

    this.elements.push(`  <Connect>
    <Stream url="${escapeXml(url)}">
${parameterElements}
    </Stream>
  </Connect>`);
    return this;
  }

  /**
   * Add a Pause element
   */
  pause(length: number = 1): this {
    this.elements.push(`  <Pause length="${length}" />`);
    return this;
  }

  /**
   * Add a Play element (play audio file)
   */
  play(url: string, loop: number = 1): this {
    this.elements.push(`  <Play loop="${loop}">${escapeXml(url)}</Play>`);
    return this;
  }

  /**
   * Add a Hangup element
   */
  hangup(): this {
    this.elements.push('  <Hangup />');
    return this;
  }

  /**
   * Add a Redirect element
   */
  redirect(url: string, method: 'GET' | 'POST' = 'POST'): this {
    this.elements.push(`  <Redirect method="${method}">${escapeXml(url)}</Redirect>`);
    return this;
  }

  /**
   * Build the final TwiML string
   */
  build(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
${this.elements.join('\n')}
</Response>`;
  }
}

/**
 * Escape special XML characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
