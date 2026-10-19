import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import https from 'node:https';
import type { IncomingMessage } from 'node:http';
import { BlockList, isIP } from 'node:net';
import { Transform } from 'node:stream';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import { domainSchema } from '../contracts';
import type { QualificationStore } from '../persistence/qualification-store';
import { evidenceSchema, ResearchError } from './contracts';
import type { PageFailure } from './contracts';

const denied = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  denied.addSubnet(network, prefix, 'ipv4');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
for (const [network, prefix] of [
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
] as const)
  denied.addSubnet(network, prefix, 'ipv6');
export function isPublicAddress(address: string) {
  const family = isIP(address);
  return family === 4
    ? !denied.check(address, 'ipv4')
    : family === 6 && globalV6.check(address, 'ipv6') && !denied.check(address, 'ipv6');
}
export function approvedUrl(value: string, domains: string[]) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ResearchError('unapproved_source');
  }
  const hostname = domainSchema.safeParse(url.hostname);
  if (
    !hostname.success ||
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443') ||
    !domains.some(domain => hostname.data === domain || hostname.data.endsWith(`.${domain}`))
  )
    throw new ResearchError('unapproved_source');
  url.hostname = hostname.data;
  url.hash = '';
  // Credentials and arbitrary query parameters must never become diagnostic data.
  if (url.href.length > 2048) throw new ResearchError('unapproved_source');
  return url;
}
/** Discovery can reject known incompatible files without spending a page reservation. */
export function unsupportedPageFormat(url: URL) {
  let path = url.pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    // Malformed escapes remain subject to normal URL and HTTP response validation.
  }
  return /\.(?:pdf|docx?|xlsx?|pptx?|odt|ods|odp|rtf|zip|gz|bz2|xz|tar|rar|7z|png|jpe?g|gif|webp|avif|svg|ico|bmp|tiff?|heic|mp3|wav|ogg|mp4|mov|avi|webm|woff2?|ttf|eot|exe|dmg|iso)$/i.test(
    path,
  );
}
export interface PageTransport {
  resolve(this: void, hostname: string): Promise<Array<{ address: string; family: number }>>;
  request(
    this: void,
    url: URL,
    pinned: { address: string; family: number },
    signal: AbortSignal,
  ): Promise<IncomingMessage>;
}
export const publicHttpsTransport: PageTransport = {
  resolve: hostname => lookup(hostname, { all: true, verbatim: true }),
  request: (url, pinned, signal) =>
    new Promise((resolve, reject) => {
      const request = https.request(
        url,
        {
          method: 'GET',
          agent: false,
          family: pinned.family,
          servername: url.hostname,
          signal,
          rejectUnauthorized: true,
          lookup: (_hostname, _options, callback) => callback(null, pinned.address, pinned.family),
          headers: {
            Accept: 'text/html,text/plain',
            'Accept-Encoding': 'gzip,br,deflate',
            'User-Agent': 'LeadQualification/1.0',
          },
        },
        resolve,
      );
      request.on('error', () => reject(new ResearchError('page_transport_failed', true)));
      request.end();
    }),
};
function visibleText(value: string) {
  const pieces: string[] = [];
  let hiddenTag: string | null = null;
  let index = 0;
  // A single forward scan also bounds work for malformed markup with no closing tag.
  while (index < value.length) {
    if (value.startsWith('<!--', index)) {
      const end = value.indexOf('-->', index + 4);
      index = end < 0 ? value.length : end + 3;
    } else if (value[index] === '<') {
      const end = value.indexOf('>', index + 1);
      if (end < 0) break;
      const tag = value
        .slice(index + 1, end)
        .trim()
        .toLowerCase();
      const name = /^\/?([a-z0-9]+)/.exec(tag)?.[1];
      if (hiddenTag && tag.startsWith('/') && name === hiddenTag) hiddenTag = null;
      else if (!hiddenTag && name && ['script', 'style', 'noscript', 'template'].includes(name) && !tag.startsWith('/'))
        hiddenTag = name;
      pieces.push(' ');
      index = end + 1;
    } else {
      const next = value.indexOf('<', index);
      const end = next < 0 ? value.length : next;
      if (!hiddenTag) pieces.push(value.slice(index, end));
      index = end;
    }
  }
  return pieces
    .join(' ')
    .replace(/&#(x[\da-f]+|\d+);/gi, (_match, code: string) => {
      const number = code.toLowerCase().startsWith('x') ? Number.parseInt(code.slice(1), 16) : Number(code);
      return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : ' ';
    })
    .replace(
      /&(nbsp|amp|lt|gt|quot|apos);/gi,
      (_match, name: string) =>
        ({ nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[name.toLowerCase()] ?? ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}
export class PageRetriever {
  constructor(private readonly transport: PageTransport = publicHttpsTransport) {}
  async retrieve(input: {
    runId: string;
    sourceUrl: string;
    domains: string[];
    providerId: string;
    deadline: number;
    store: QualificationStore;
  }) {
    let url = approvedUrl(input.sourceUrl, input.domains);
    const signal = AbortSignal.timeout(Math.max(1, input.deadline - Date.now()));
    for (;;) {
      if (unsupportedPageFormat(url)) throw new ResearchError('unsupported_source_format');
      const reservation = await input.store.reserve(input.runId, 'page');
      if (Date.now() >= input.deadline || signal.aborted) throw new ResearchError('deadline_exhausted');
      const addresses = await new Promise<Awaited<ReturnType<PageTransport['resolve']>>>((resolve, reject) => {
        const onAbort = () => reject(new ResearchError('deadline_exhausted'));
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
        Promise.resolve()
          .then(() => {
            if (signal.aborted) throw new ResearchError('deadline_exhausted');
            return this.transport.resolve(url.hostname);
          })
          .then(
            addresses => {
              signal.removeEventListener('abort', onAbort);
              resolve(addresses);
            },
            error => {
              signal.removeEventListener('abort', onAbort);
              reject(error);
            },
          );
      });
      if (
        !addresses.length ||
        addresses.some(value => !isPublicAddress(value.address) || isIP(value.address) !== value.family)
      )
        throw new ResearchError('unsafe_source_address');
      if (Date.now() >= input.deadline || signal.aborted) throw new ResearchError('deadline_exhausted');
      const response = await this.transport.request(url, addresses[0]!, signal);
      try {
        if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) {
          const location = response.headers.location;
          if (!location) throw new ResearchError('invalid_redirect');
          url = approvedUrl(new URL(location, url).href, input.domains);
          // The unread body retains its byte reservation; each hop needs a new reservation.
          continue;
        }
        if (response.statusCode !== 200) {
          const retryAfter = response.headers['retry-after'];
          const delay = retryAfter
            ? /^\d+$/.test(retryAfter)
              ? Number(retryAfter) * 1000
              : Math.max(0, Date.parse(retryAfter) - Date.now())
            : 0;
          throw new ResearchError(
            'page_http_failed',
            response.statusCode === 429 || (response.statusCode ?? 0) >= 500,
            Number.isFinite(delay) ? delay : 0,
          );
        }
        const contentType = response.headers['content-type']?.split(';')[0]?.trim().toLowerCase();
        if (!['text/plain', 'text/html', 'application/xhtml+xml'].includes(contentType ?? ''))
          throw new ResearchError('unsupported_page_type');
        let compressedBytes = 0;
        let decodedBytes = 0;
        const encoding = response.headers['content-encoding']?.toLowerCase();
        const safeEncoding = ['identity', 'gzip', 'br', 'deflate'].includes(encoding ?? 'identity')
          ? ((encoding ?? 'identity') as PageFailure['encoding'])
          : 'other';
        const length = response.headers['content-length'];
        const validLength = length !== undefined && /^\d+$/.test(length) && Number.isSafeInteger(Number(length));
        const declaredLength = validLength ? Number(length) : null;
        const byteFailure = (phase: PageFailure['phase']) =>
          new ResearchError('page_byte_limit', false, 0, {
            phase,
            declaredLength,
            encoding: safeEncoding,
            observedCompressedBytes: compressedBytes,
            observedDecodedBytes: decodedBytes,
            byteCap: reservation.bytes,
          });
        if (length !== undefined && !validLength) throw byteFailure('content_length_malformed');
        if (declaredLength !== null && declaredLength > reservation.bytes) throw byteFailure('declared_too_large');
        const compressedCounter = new Transform({
          transform(chunk: Buffer, _encoding, callback) {
            compressedBytes += chunk.length;
            callback(compressedBytes > reservation.bytes ? byteFailure('compressed_overflow') : null, chunk);
          },
        });
        const decoders = { gzip: createGunzip, br: createBrotliDecompress, deflate: createInflate };
        if (encoding && encoding !== 'identity' && !(encoding in decoders))
          throw new ResearchError('unsupported_page_encoding');
        const decoder =
          encoding && encoding in decoders
            ? decoders[encoding as keyof typeof decoders]()
            : new Transform({
                transform(chunk, _encoding, callback) {
                  callback(null, chunk);
                },
              });
        const stream = response.pipe(compressedCounter).pipe(decoder);
        response.on('error', error => stream.destroy(error));
        compressedCounter.on('error', error => stream.destroy(error));
        const chunks: Buffer[] = [];
        try {
          for await (const chunk of stream) {
            const bytes = Buffer.from(chunk as Uint8Array);
            decodedBytes += bytes.length;
            if (decodedBytes > reservation.bytes) throw byteFailure('decoded_overflow');
            chunks.push(bytes);
          }
        } finally {
          stream.destroy();
          compressedCounter.destroy();
        }
        await input.store.settle(reservation, { compressedBytes, decodedBytes });
        const text = visibleText(Buffer.concat(chunks).toString('utf8')).slice(0, 24_000);
        if (!text) throw new ResearchError('empty_page');
        const digest = createHash('sha256').update(text).digest('hex');
        return evidenceSchema.parse({
          id: `web-${createHash('sha256')
            .update(url.href + digest)
            .digest('hex')
            .slice(0, 24)}`,
          kind: 'website',
          source: url.href,
          title: url.hostname,
          retrievedAt: new Date().toISOString(),
          publishedAt: null,
          excerpt: text,
          digest,
          providerId: input.providerId,
          retrieval: 'page',
        });
      } finally {
        response.destroy();
      }
    }
  }
}
