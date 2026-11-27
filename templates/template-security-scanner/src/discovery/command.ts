import { z } from 'zod';
import { urlSchema } from '../core/contracts.js';
import { BROWSER_FLAGS } from '../runtime/browser.js';
import { discoveryModeSchema } from './contracts.js';

const commandInput = z
  .object({
    entryUrl: urlSchema,
    mode: discoveryModeSchema,
    proxy: z.string().regex(/^http:\/\/(?:\d{1,3}\.){3}\d{1,3}:(?:808[0-9]|809[0-9]|810[0-9]|811[01])$/),
  })
  .strict();
const katanaBrand: unique symbol = Symbol('fixed-katana-command');
/** Opaque fixed Katana invocation produced only by the validated command builder. */
export type KatanaCommand = {
  /** Fixed allowlisted crawler executable. */
  executable: 'katana';
  /** Validated fixed arguments; credentials are never command arguments. */
  args: string[];
  /** Brand assigned by the trusted builder, never accepted from API input. */
  [katanaBrand]: true;
};
/** Fixed read-only request; credentials are injected by the gateway after policy checks. */
export type RestCommand = {
  executable: 'katana';
  args: string[];
  [katanaBrand]: true;
};
export function restCommand(url: string, proxy: string): RestCommand {
  const parsed = urlSchema.parse(url);
  return {
    executable: 'katana',
    args: [
      '-jsonl',
      '-silent',
      '-no-color',
      '-disable-update-check',
      '-disable-unique-filter',
      '-omit-raw',
      '-exclude-output-fields',
      'raw,reader,resp,customfields,knowledgebase,extra',
      '-depth',
      '0',
      '-disable-redirects',
      '-concurrency',
      '1',
      '-parallelism',
      '1',
      '-rate-limit',
      '10',
      '-retry',
      '0',
      '-timeout',
      '4',
      '-crawl-duration',
      '2s',
      '-max-response-size',
      '32768',
      '-max-domain-pages',
      '1',
      '-proxy',
      proxy,
      '-u',
      parsed,
    ],
    [katanaBrand]: true,
  };
}
/** Construct bounded Katana arguments for the authorized target and selected discovery mode. */
export function katanaCommand(input: z.infer<typeof commandInput>): KatanaCommand {
  const { entryUrl, mode, proxy } = commandInput.parse(input);
  const args = [
    '-jsonl',
    '-silent',
    '-no-color',
    '-disable-update-check',
    '-disable-unique-filter',
    '-omit-raw',
    '-omit-body',
    '-exclude-output-fields',
    'raw,body,reader,resp,customfields,knowledgebase,extra',
    '-form-extraction',
    '-depth',
    '2',
    '-concurrency',
    '1',
    '-parallelism',
    '1',
    '-rate-limit',
    '10',
    '-retry',
    '0',
    '-timeout',
    '4',
    '-crawl-duration',
    '12s',
    '-max-response-size',
    '32768',
    '-max-domain-pages',
    '8',
    '-headers',
    '/workspace/headers',
    '-proxy',
    proxy,
    '-u',
    entryUrl,
  ];
  if (mode === 'headless')
    args.push(
      '-hybrid',
      '-system-chrome',
      '-system-chrome-path',
      '/workspace/chromium-safe',
      '-xhr-extraction',
      '-headless-options',
      BROWSER_FLAGS.filter(flag => flag !== '--headless')
        .map(flag => `${flag.slice(2)}=true`)
        .join(','),
    );
  return { executable: 'katana', args, [katanaBrand]: true };
}
