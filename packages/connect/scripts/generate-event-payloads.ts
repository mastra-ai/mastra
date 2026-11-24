/**
 * Generates `src/event-payloads/*.generated.ts`: types for the provider
 * webhook payloads `ConnectEvents` delivers, built from each provider's
 * published contract rather than from sample payloads.
 *
 * - GitHub: the `x-webhooks` of GitHub's REST OpenAPI description.
 * - Linear: the `*WebhookPayload` types of Linear's GraphQL schema, with the
 *   envelopes and actions from Linear's webhook docs.
 * - incident.io: the `x-webhooks` of incident.io's OpenAPI description.
 * - Jira: the envelope from Atlassian's webhook docs, holding the issue, user
 *   and comment shapes of Jira's REST OpenAPI description, which the docs
 *   name as the payload's shapes.
 *
 * GitLab publishes its webhook payloads only as prose, so its types are
 * written by hand in `src/event-payloads/gitlab.ts`.
 *
 * Usage: pnpm generate:event-payloads [--cache-dir <dir>]
 * With --cache-dir, contracts already in the directory are read from it, and
 * downloaded ones are saved to it.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(PACKAGE_ROOT, 'src/event-payloads');

interface Source {
  file: string;
  url: string;
}

const SOURCES = {
  github: {
    file: 'github.json',
    url: 'https://raw.githubusercontent.com/github/rest-api-description/bbd57e64767616df3b37792a1186166334043761/descriptions/api.github.com/api.github.com.json',
  },
  linear: {
    file: 'linear.graphql',
    url: 'https://raw.githubusercontent.com/linear/linear/2ca00918e3ae699a0aa1a6b07330b433397cd201/packages/sdk/src/schema.graphql',
  },
  // incident.io and Atlassian publish no versioned URL; the generated header
  // records the description's version and the file's SHA-256.
  incidentIo: { file: 'incidentio-openapi.json', url: 'https://api.incident.io/v1/openapiV3.json' },
  jira: { file: 'jira-openapi.json', url: 'https://developer.atlassian.com/cloud/jira/platform/swagger-v3.v3.json' },
} satisfies Record<string, Source>;

/** GitHub `X-GitHub-Event` values whose every action is typed. */
const GITHUB_EVENTS = [
  'check_run',
  'check_suite',
  'create',
  'delete',
  'dependabot_alert',
  'deployment_status',
  'installation',
  'installation_repositories',
  'issue_comment',
  'issues',
  'pull_request',
  'pull_request_review',
  'pull_request_review_comment',
  'pull_request_review_thread',
  'push',
  'release',
  'status',
  'workflow_job',
  'workflow_run',
];

/** Linear's data change resources (the `Linear-Event` header and the body's `type`). */
const LINEAR_DATA_RESOURCES = [
  'Attachment',
  'Comment',
  'Customer',
  'CustomerNeed',
  'Cycle',
  'Document',
  'Initiative',
  'InitiativeUpdate',
  'Issue',
  'IssueLabel',
  'Project',
  'ProjectUpdate',
  'Reaction',
  'User',
];
const LINEAR_DATA_ACTIONS = ['create', 'update', 'remove'];
const LINEAR_ISSUE_SLA_ACTIONS = ['set', 'highRisk', 'breached'];

const JIRA_ISSUE_EVENTS = ['jira:issue_created', 'jira:issue_updated', 'jira:issue_deleted'];
const JIRA_COMMENT_EVENTS = ['comment_created', 'comment_updated', 'comment_deleted'];

interface Loaded {
  text: string;
  sha256: string;
}

async function load(source: Source, cacheDir: string | undefined): Promise<Loaded> {
  let text: string | undefined;
  if (cacheDir) {
    text = await readFile(join(cacheDir, source.file), 'utf8').catch(() => undefined);
  }
  if (text === undefined) {
    const response = await fetch(source.url, { headers: { 'user-agent': 'mastra-connect-codegen' } });
    if (!response.ok) throw new Error(`GET ${source.url} answered ${response.status}`);
    text = await response.text();
    if (cacheDir) {
      await mkdir(cacheDir, { recursive: true });
      await writeFile(join(cacheDir, source.file), text);
    }
  }
  return { text, sha256: createHash('sha256').update(text).digest('hex') };
}

// ---------------------------------------------------------------------------
// Shared emit helpers

function pascal(name: string): string {
  return name
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map(part => part[0]!.toUpperCase() + part.slice(1))
    .join('');
}

function propertyKey(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

function doc(description: unknown, deprecated?: boolean | string): string {
  const lines: string[] = [];
  if (typeof description === 'string') {
    const text = description
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\*\//g, '*\\/');
    if (text) lines.push(text.length > 240 ? `${text.slice(0, 237).trimEnd()}...` : text);
  }
  if (deprecated) lines.push(typeof deprecated === 'string' ? `@deprecated ${deprecated}` : '@deprecated');
  if (lines.length === 0) return '';
  return `/** ${lines.join('\n * ')} */\n`;
}

function union(types: string[]): string {
  const unique = [...new Set(types)];
  if (unique.includes('unknown')) return 'unknown';
  return unique.length === 0 ? 'never' : unique.join(' | ');
}

function wrap(type: string): string {
  return /[|&]/.test(type) ? `(${type})` : type;
}

/** Whether a type is one `{ ... }` object literal, which can be an interface. */
function isObjectLiteral(type: string): boolean {
  if (!type.startsWith('{')) return false;
  let depth = 0;
  let quote: string | undefined;
  for (let i = 0; i < type.length; i++) {
    const char = type[i];
    if (quote) {
      if (char === '\\') i++;
      else if (char === quote) quote = undefined;
    } else if (char === '"') {
      quote = char;
    } else if (char === '{') {
      depth++;
    } else if (char === '}' && --depth === 0) {
      return i === type.length - 1;
    }
  }
  return false;
}

function header(sources: string[]): string {
  return [
    '// This file is generated by `pnpm generate:event-payloads`. Do not edit it.',
    ...sources.map(source => `// Source: ${source}`),
    '',
    '',
  ].join('\n');
}

async function emit(file: string, code: string): Promise<void> {
  const config = await prettier.resolveConfig(join(OUT_DIR, file));
  const formatted = await prettier.format(code, { ...config, parser: 'typescript' });
  await writeFile(join(OUT_DIR, file), formatted);
  console.info(`wrote src/event-payloads/${file} (${formatted.split('\n').length} lines)`);
}

// ---------------------------------------------------------------------------
// OpenAPI (JSON Schema) to TypeScript

type Schema = { [key: string]: unknown };

function isSchema(value: unknown): value is Schema {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Emits the component schemas a set of roots reaches. Objects are closed: a
 * property the contract doesn't list is a type error, not `unknown`.
 *
 * Inline object schemas that recur (GitHub's description copies the same
 * pull request or repository object into every action's schema) are hoisted
 * into one named type: a first pass counts them, a second emits.
 */
class OpenApiEmitter {
  readonly #schemas: Record<string, Schema>;
  readonly #prefix: string;
  readonly #names = new Map<string, string>();
  readonly #queue: string[] = [];
  readonly #usedNames = new Set<string>();
  readonly #counts = new Map<string, number>();
  readonly #hoisted = new Map<string, string>();
  readonly #hoistQueue: Array<{ name: string; schema: Schema }> = [];
  #counting = true;

  constructor(document: Schema, prefix: string) {
    const components = document.components;
    this.#schemas = isSchema(components) && isSchema(components.schemas) ? (components.schemas as never) : {};
    this.#prefix = prefix;
  }

  /** The TypeScript name of a component schema, queued for emitting. */
  ref(component: string): string {
    let name = this.#names.get(component);
    if (!name) {
      if (!this.#schemas[component]) throw new Error(`Unknown component schema ${component}`);
      name = this.#uniqueName(`${this.#prefix}${pascal(component)}`);
      this.#names.set(component, name);
      this.#queue.push(component);
    }
    return name;
  }

  #uniqueName(base: string): string {
    let name = base;
    for (let n = 2; this.#usedNames.has(name); n++) name = `${base}${n}`;
    this.#usedNames.add(name);
    return name;
  }

  #type(schema: unknown, path: string, root = false): string {
    if (!isSchema(schema)) return 'unknown';
    const type = this.#baseType(schema, path, root);
    return schema.nullable === true && type !== 'unknown' && !/\bnull\b/.test(type) ? `${type} | null` : type;
  }

  #baseType(schema: Schema, path: string, root: boolean): string {
    if (typeof schema.$ref === 'string') {
      const match = /^#\/components\/schemas\/(.+)$/.exec(schema.$ref);
      if (!match) throw new Error(`Unsupported $ref ${schema.$ref}`);
      return this.ref(match[1]!);
    }
    if (Array.isArray(schema.enum)) {
      return union(schema.enum.map(value => (value === null ? 'null' : JSON.stringify(value))));
    }
    if (typeof schema.const !== 'undefined') return JSON.stringify(schema.const);
    for (const key of ['oneOf', 'anyOf'] as const) {
      const options = schema[key];
      if (Array.isArray(options)) return union(options.map(option => this.#type(option, path)));
    }
    if (Array.isArray(schema.allOf)) {
      const parts = schema.allOf.map(part => this.#type(part, path)).filter(part => part !== 'unknown');
      return parts.length === 0 ? 'unknown' : [...new Set(parts)].map(wrap).join(' & ');
    }
    if (Array.isArray(schema.type)) {
      return union(schema.type.map(type => this.#baseType({ ...schema, type }, path, root)));
    }
    switch (schema.type) {
      case 'string':
        return 'string';
      case 'integer':
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'null':
        return 'null';
      case 'array':
        return `Array<${this.#type(schema.items, `${path}Item`)}>`;
      case 'object':
        return this.#object(schema, path, root);
      default:
        return isSchema(schema.properties) ? this.#object(schema, path, root) : 'unknown';
    }
  }

  #object(schema: Schema, path: string, root: boolean): string {
    const properties = isSchema(schema.properties) ? schema.properties : {};
    const keys = Object.keys(properties);
    if (keys.length === 0) {
      return isSchema(schema.additionalProperties)
        ? `Record<string, ${this.#type(schema.additionalProperties, `${path}Value`)}>`
        : 'Record<string, unknown>';
    }
    if (!root) {
      const key = JSON.stringify(schema);
      const seen = this.#counts.get(key) ?? 0;
      if (this.#counting) {
        this.#counts.set(key, seen + 1);
        // Its contents were counted the first time.
        if (seen > 0) return '{}';
      } else if (seen > 1) {
        return this.#hoist(key, schema, path);
      }
    }
    const required = new Set(Array.isArray(schema.required) ? schema.required : []);
    const members = keys.map(key => {
      const property = properties[key];
      const comment = isSchema(property) ? doc(property.description, property.deprecated === true) : '';
      return `${comment}${propertyKey(key)}${required.has(key) ? '' : '?'}: ${this.#type(property, `${path}${pascal(key)}`)};`;
    });
    return `{\n${members.join('\n')}\n}`;
  }

  #hoist(key: string, schema: Schema, path: string): string {
    let name = this.#hoisted.get(key);
    if (!name) {
      const title = typeof schema.title === 'string' ? `${this.#prefix}${pascal(schema.title)}` : undefined;
      name = this.#uniqueName(title && !this.#usedNames.has(title) ? title : path);
      this.#hoisted.set(key, name);
      this.#hoistQueue.push({ name, schema });
    }
    return name;
  }

  #declaration(name: string, schema: Schema): string {
    const type = this.#type(schema, name, true);
    const comment = doc(schema.description ?? schema.title, schema.deprecated === true);
    return isObjectLiteral(type)
      ? `${comment}export interface ${name} ${type}`
      : `${comment}export type ${name} = ${type};`;
  }

  /** Declarations for every component reached so far, and any they reach. */
  declarations(): string {
    this.#counting = true;
    for (let i = 0; i < this.#queue.length; i++) {
      const component = this.#queue[i]!;
      this.#type(this.#schemas[component], this.#names.get(component)!, true);
    }
    this.#counting = false;
    const out: string[] = [];
    for (let i = 0; i < this.#queue.length; i++) {
      const component = this.#queue[i]!;
      out.push(this.#declaration(this.#names.get(component)!, this.#schemas[component]!));
    }
    for (let i = 0; i < this.#hoistQueue.length; i++) {
      const { name, schema } = this.#hoistQueue[i]!;
      out.push(this.#declaration(name, schema));
    }
    return out.join('\n\n');
  }
}

function mapInterface(name: string, description: string, entries: Array<[string, string]>): string {
  const sorted = [...entries].sort(([a], [b]) => a.localeCompare(b));
  return `${doc(description)}export interface ${name} {\n${sorted
    .map(([key, type]) => `${JSON.stringify(key)}: ${type};`)
    .join('\n')}\n}`;
}

// ---------------------------------------------------------------------------
// GitHub

/** The `action` values a webhook body schema allows, through refs and unions. */
function actionsOf(document: Schema, schema: Schema): string[] {
  if (typeof schema.$ref === 'string') {
    const component = /^#\/components\/schemas\/(.+)$/.exec(schema.$ref)?.[1];
    const target = component && (document.components as { schemas: Record<string, Schema> }).schemas[component];
    return target ? actionsOf(document, target) : [];
  }
  const action =
    isSchema(schema.properties) && isSchema(schema.properties.action) ? schema.properties.action : undefined;
  if (action && Array.isArray(action.enum))
    return action.enum.filter((value): value is string => typeof value === 'string');
  return ['oneOf', 'anyOf', 'allOf'].flatMap(key => {
    const branches = schema[key];
    return Array.isArray(branches) ? branches.filter(isSchema).flatMap(branch => actionsOf(document, branch)) : [];
  });
}

async function generateGithub(cacheDir: string | undefined): Promise<void> {
  const loaded = await load(SOURCES.github, cacheDir);
  const document = JSON.parse(loaded.text) as Schema;
  const webhooks = document['x-webhooks'] as Record<string, { post: Schema }>;
  const emitter = new OpenApiEmitter(document, 'Github');
  const entries: Array<[string, string]> = [];
  const wanted = new Set(GITHUB_EVENTS);

  for (const webhook of Object.values(webhooks)) {
    const parameters = (webhook.post.parameters ?? []) as Schema[];
    const event = parameters.find(parameter => parameter.name === 'X-Github-Event')?.example;
    if (typeof event !== 'string' || !wanted.has(event)) continue;
    const requestBody = webhook.post.requestBody as Schema;
    const content = (requestBody.content as Record<string, { schema: Schema }>)['application/json']!;
    const ref = /^#\/components\/schemas\/(.+)$/.exec(String(content.schema.$ref))?.[1];
    if (!ref) throw new Error(`GitHub webhook ${event} has no component schema`);
    const body = (document.components as { schemas: Record<string, Schema> }).schemas[ref]!;
    const actions = [...new Set(actionsOf(document, body))];
    const type = emitter.ref(ref);
    if (actions.length === 0) entries.push([event, type]);
    for (const value of actions) entries.push([`${event}.${value}`, type]);
  }

  const duplicate = entries.find(([key], index) => entries.findIndex(([other]) => other === key) !== index);
  if (duplicate) throw new Error(`GitHub's description has two webhooks for ${duplicate[0]}`);

  const missing = GITHUB_EVENTS.filter(event => !entries.some(([key]) => key === event || key.startsWith(`${event}.`)));
  if (missing.length > 0) throw new Error(`GitHub's description has no webhooks for ${missing.join(', ')}`);

  await emit(
    'github.generated.ts',
    header([SOURCES.github.url]) +
      mapInterface(
        'GithubWebhookPayloads',
        "GitHub webhook payloads by Connect event type: the `X-GitHub-Event` header, then `.` and the body's `action` when the event has one.",
        entries,
      ) +
      '\n\n' +
      emitter.declarations(),
  );
}

// ---------------------------------------------------------------------------
// incident.io

async function generateIncidentIo(cacheDir: string | undefined): Promise<void> {
  const loaded = await load(SOURCES.incidentIo, cacheDir);
  const document = JSON.parse(loaded.text) as Schema;
  const webhooks = document['x-webhooks'] as Record<string, Record<string, Schema>>;
  const emitter = new OpenApiEmitter(document, 'IncidentIo');
  const entries: Array<[string, string]> = [];

  for (const [path, operations] of Object.entries(webhooks)) {
    const match = /^\/x-webhooks\/(.+)$/.exec(path);
    if (!match) continue;
    const eventType = match[1]!;
    const operation = Object.values(operations)[0]!;
    const responses = operation.responses as Record<string, { content: Record<string, { schema: Schema }> }>;
    const ref = /^#\/components\/schemas\/(.+)$/.exec(
      String(responses['200']?.content['application/json']?.schema.$ref),
    )?.[1];
    if (!ref) throw new Error(`incident.io webhook ${eventType} has no component schema`);
    entries.push([eventType, `IncidentIoWebhook<${emitter.ref(ref)}, ${JSON.stringify(eventType)}>`]);
  }
  if (entries.length === 0) throw new Error("incident.io's description has no webhooks");

  const envelope = `
/**
 * An incident.io webhook body, with \`event_type\` narrowed to its event. The
 * description gives every body the enum of all events.
 */
export type IncidentIoWebhook<Body, Event extends string> = Omit<Body, 'event_type'> & { event_type: Event };
`;

  const version = (document.info as Schema).version;
  await emit(
    'incident-io.generated.ts',
    header([`${SOURCES.incidentIo.url} (version ${String(version)}, sha256 ${loaded.sha256})`]) +
      mapInterface(
        'IncidentIoWebhookPayloads',
        "incident.io webhook payloads by Connect event type: the body's `event_type`.",
        entries,
      ) +
      '\n' +
      envelope +
      '\n' +
      emitter.declarations(),
  );
}

// ---------------------------------------------------------------------------
// Jira

async function generateJira(cacheDir: string | undefined): Promise<void> {
  const loaded = await load(SOURCES.jira, cacheDir);
  const document = JSON.parse(loaded.text) as Schema;
  const emitter = new OpenApiEmitter(document, 'Jira');
  const issue = emitter.ref('IssueBean');
  const user = emitter.ref('UserDetails');
  const comment = emitter.ref('Comment');

  const envelopes = `
/** A changed field in a \`jira:issue_updated\` event's changelog. */
export interface JiraWebhookChangelogItem {
  /** The name of the field changed. */
  field: string;
  /** The ID of the field changed. */
  fieldId?: string;
  /** The type of the field changed. */
  fieldtype: string;
  /** The original value. */
  from: string | null;
  /** The original value as a string. */
  fromString: string | null;
  /** The new value. */
  to: string | null;
  /** The new value as a string. */
  toString: string | null;
}

/** A \`jira:issue_updated\` event's changelog: one item for each changed field. */
export interface JiraWebhookChangelog {
  id: string | number;
  items: JiraWebhookChangelogItem[];
}

interface JiraWebhookBase<Event extends string> {
  /** When the event happened, in milliseconds since the epoch. */
  timestamp: number;
  webhookEvent: Event;
  /** Set when a bulk operation triggered the webhook. */
  bulkOperationMetaData?: { sendMail?: boolean };
}

/** An issue event. \`user\` is the user who made the change. */
export interface JiraIssueWebhook<Event extends string> extends JiraWebhookBase<Event> {
  /** The Jira event that triggered the callback, such as \`issue_generic\`. */
  issue_event_type_name?: string;
  user: ${user};
  /** The issue as Jira's REST API returns it with no expand parameters. */
  issue: ${issue};
  /** Present only on \`jira:issue_updated\`. */
  changelog?: JiraWebhookChangelog;
}

/** A comment event, with the comment and the issue it belongs to. */
export interface JiraCommentWebhook<Event extends string> extends JiraWebhookBase<Event> {
  comment: ${comment};
  issue: ${issue};
  user?: ${user};
}
`;

  const entries: Array<[string, string]> = [
    ...JIRA_ISSUE_EVENTS.map((event): [string, string] => [event, `JiraIssueWebhook<${JSON.stringify(event)}>`]),
    ...JIRA_COMMENT_EVENTS.map((event): [string, string] => [event, `JiraCommentWebhook<${JSON.stringify(event)}>`]),
  ];
  const version = (document.info as Schema).version;
  await emit(
    'jira.generated.ts',
    header([
      'https://developer.atlassian.com/cloud/jira/platform/webhooks/ (envelopes)',
      `${SOURCES.jira.url} (version ${String(version)}, sha256 ${loaded.sha256})`,
    ]) +
      mapInterface(
        'JiraWebhookPayloads',
        "Jira webhook payloads by Connect event type: the body's `webhookEvent`.",
        entries,
      ) +
      '\n' +
      envelopes +
      '\n' +
      emitter.declarations(),
  );
}

// ---------------------------------------------------------------------------
// Linear (GraphQL SDL)

type GraphqlType =
  | { kind: 'named'; name: string; nonNull: boolean }
  | { kind: 'list'; of: GraphqlType; nonNull: boolean };

interface GraphqlField {
  name: string;
  type: GraphqlType;
  description?: string;
  deprecated?: string | true;
}

type GraphqlDefinition =
  | { kind: 'object'; name: string; description?: string; fields: GraphqlField[] }
  | { kind: 'union'; name: string; description?: string; members: string[] }
  | { kind: 'enum'; name: string; description?: string; values: string[] }
  | { kind: 'scalar'; name: string };

const DEFINITION_KEYWORDS = new Set([
  'type',
  'interface',
  'input',
  'union',
  'enum',
  'scalar',
  'directive',
  'schema',
  'extend',
]);

function tokenize(source: string): string[] {
  const tokens: string[] = [];
  const pattern =
    /\s+|,|#[^\n]*|("""[\s\S]*?"""|"(?:[^"\\\n]|\\.)*")|([{}()[\]:!=|@&])|([_A-Za-z][_0-9A-Za-z]*)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(\.\.\.|\$)/y;
  let index = 0;
  while (index < source.length) {
    pattern.lastIndex = index;
    const match = pattern.exec(source);
    if (!match)
      throw new Error(`Unexpected character in GraphQL schema at ${index}: ${source.slice(index, index + 20)}`);
    index = pattern.lastIndex;
    const token = match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5];
    if (token !== undefined) tokens.push(token);
  }
  return tokens;
}

function stringValue(token: string): string {
  if (token.startsWith('"""')) return token.slice(3, -3).trim();
  return JSON.parse(token) as string;
}

function parseGraphqlSchema(source: string): Map<string, GraphqlDefinition> {
  const tokens = tokenize(source);
  const definitions = new Map<string, GraphqlDefinition>();
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++]!;
  const isString = (token: string | undefined) => token !== undefined && token.startsWith('"');
  const skipBalanced = (open: string, close: string) => {
    let depth = 0;
    do {
      const token = next();
      if (token === open) depth++;
      else if (token === close) depth--;
    } while (depth > 0);
  };
  const parseDirectives = (): string | true | undefined => {
    let deprecated: string | true | undefined;
    while (peek() === '@') {
      next();
      const name = next();
      if (peek() === '(') {
        const start = i;
        skipBalanced('(', ')');
        if (name === 'deprecated') {
          const reason = tokens.slice(start, i).find(token => isString(token));
          deprecated = reason ? stringValue(reason) : true;
        }
      } else if (name === 'deprecated') {
        deprecated = true;
      }
    }
    return deprecated;
  };
  const parseType = (): GraphqlType => {
    let type: GraphqlType;
    if (peek() === '[') {
      next();
      const of = parseType();
      if (next() !== ']') throw new Error('Expected ] in GraphQL type');
      type = { kind: 'list', of, nonNull: false };
    } else {
      type = { kind: 'named', name: next(), nonNull: false };
    }
    if (peek() === '!') {
      next();
      type.nonNull = true;
    }
    return type;
  };

  while (i < tokens.length) {
    const description = isString(peek()) ? stringValue(next()) : undefined;
    const keyword = next();
    switch (keyword) {
      case 'schema':
        parseDirectives();
        skipBalanced('{', '}');
        break;
      case 'directive':
        // Locations are upper case; the next definition starts with a lower case keyword or a description.
        while (i < tokens.length && !isString(peek()) && !DEFINITION_KEYWORDS.has(peek()!)) {
          if (peek() === '(') skipBalanced('(', ')');
          else next();
        }
        break;
      case 'scalar': {
        const name = next();
        parseDirectives();
        definitions.set(name, { kind: 'scalar', name });
        break;
      }
      case 'enum': {
        const name = next();
        parseDirectives();
        const values: string[] = [];
        next(); // {
        while (peek() !== '}') {
          if (isString(peek())) next();
          values.push(next());
          parseDirectives();
        }
        next();
        definitions.set(name, { kind: 'enum', name, description, values });
        break;
      }
      case 'union': {
        const name = next();
        parseDirectives();
        const members: string[] = [];
        if (peek() === '=') {
          next();
          if (peek() === '|') next();
          members.push(next());
          while (peek() === '|') {
            next();
            members.push(next());
          }
        }
        definitions.set(name, { kind: 'union', name, description, members });
        break;
      }
      case 'type':
      case 'interface':
      case 'input': {
        const name = next();
        if (peek() === 'implements') {
          next();
          while (peek() !== '{' && peek() !== '@') next();
        }
        parseDirectives();
        const fields: GraphqlField[] = [];
        if (peek() === '{') {
          next();
          while (peek() !== '}') {
            const fieldDescription = isString(peek()) ? stringValue(next()) : undefined;
            const fieldName = next();
            if (peek() === '(') skipBalanced('(', ')');
            if (next() !== ':') throw new Error(`Expected : after ${name}.${fieldName}`);
            const type = parseType();
            if (peek() === '=') {
              next();
              if (peek() === '[') skipBalanced('[', ']');
              else if (peek() === '{') skipBalanced('{', '}');
              else next();
            }
            const deprecated = parseDirectives();
            fields.push({ name: fieldName, type, description: fieldDescription, deprecated });
          }
          next();
        }
        if (keyword !== 'input') definitions.set(name, { kind: 'object', name, description, fields });
        break;
      }
      case 'extend':
        throw new Error('GraphQL schema extensions are not supported');
      default:
        throw new Error(`Unexpected token in GraphQL schema: ${keyword}`);
    }
  }
  return definitions;
}

const LINEAR_SCALARS: Record<string, string> = {
  Boolean: 'boolean',
  DateTime: 'string',
  Float: 'number',
  ID: 'string',
  Int: 'number',
  JSON: 'unknown',
  JSONObject: 'Record<string, unknown>',
  String: 'string',
  TimelessDate: 'string',
};

class LinearEmitter {
  readonly #definitions: Map<string, GraphqlDefinition>;
  readonly #queue: string[] = [];
  readonly #seen = new Set<string>();

  constructor(definitions: Map<string, GraphqlDefinition>) {
    this.#definitions = definitions;
  }

  name(graphqlName: string): string {
    const scalar = LINEAR_SCALARS[graphqlName];
    if (scalar) return scalar;
    const definition = this.#definitions.get(graphqlName);
    if (!definition) throw new Error(`Linear schema has no type ${graphqlName}`);
    if (definition.kind === 'scalar') return 'unknown';
    if (!this.#seen.has(graphqlName)) {
      this.#seen.add(graphqlName);
      this.#queue.push(graphqlName);
    }
    return `Linear${graphqlName}`;
  }

  #type(type: GraphqlType): string {
    const inner = type.kind === 'list' ? `Array<${this.#type(type.of)}>` : this.name(type.name);
    return type.nonNull || inner === 'unknown' ? inner : `${inner} | null`;
  }

  declarations(): string {
    const out: string[] = [];
    for (let i = 0; i < this.#queue.length; i++) {
      const definition = this.#definitions.get(this.#queue[i]!)!;
      const name = `Linear${definition.name}`;
      switch (definition.kind) {
        case 'object': {
          const members = definition.fields.map(
            field =>
              `${doc(field.description, field.deprecated)}${field.name}${field.type.nonNull ? '' : '?'}: ${this.#type(field.type)};`,
          );
          out.push(`${doc(definition.description)}export interface ${name} {\n${members.join('\n')}\n}`);
          break;
        }
        case 'union':
          out.push(
            `${doc(definition.description)}export type ${name} = ${union(definition.members.map(member => this.name(member)))};`,
          );
          break;
        case 'enum':
          out.push(
            `${doc(definition.description)}export type ${name} = ${union(definition.values.map(value => JSON.stringify(value)))};`,
          );
          break;
        case 'scalar':
          break;
      }
    }
    return out.join('\n\n');
  }
}

async function generateLinear(cacheDir: string | undefined): Promise<void> {
  const loaded = await load(SOURCES.linear, cacheDir);
  const emitter = new LinearEmitter(parseGraphqlSchema(loaded.text));
  const entity = emitter.name('EntityWebhookPayload');
  const sla = emitter.name('IssueSlaWebhookPayload');
  const oauthApp = emitter.name('OAuthAppWebhookPayload');

  const entries: Array<[string, string]> = [];
  for (const resource of LINEAR_DATA_RESOURCES) {
    const data = emitter.name(`${resource}WebhookPayload`);
    for (const action of LINEAR_DATA_ACTIONS) {
      entries.push([
        `${resource}.${action}`,
        `LinearDataChangeWebhook<${JSON.stringify(resource)}, ${JSON.stringify(action)}, ${data}>`,
      ]);
    }
  }
  for (const action of LINEAR_ISSUE_SLA_ACTIONS) {
    entries.push([`IssueSLA.${action}`, `LinearEventWebhook<${sla}, "IssueSLA", ${JSON.stringify(action)}>`]);
  }
  entries.push(['OAuthApp.revoked', `LinearEventWebhook<${oauthApp}, "OAuthApp", "revoked">`]);

  const envelopes = `
/**
 * A data change event: \`action\` is \`create\`, \`update\` or \`remove\`, \`type\`
 * the entity type, and \`data\` the entity.
 */
export type LinearDataChangeWebhook<Type extends string, Action extends string, Data> = Omit<
  ${entity},
  'action' | 'type' | 'data'
> & { action: Action; type: Type; data: Data };

/** One of Linear's other events, with its \`type\` and \`action\` narrowed. */
export type LinearEventWebhook<Payload, Type extends string, Action extends string> = Omit<
  Payload,
  'action' | 'type'
> & { action: Action; type: Type };
`;

  await emit(
    'linear.generated.ts',
    header(['https://linear.app/developers/webhooks (envelopes and actions)', SOURCES.linear.url]) +
      mapInterface(
        'LinearWebhookPayloads',
        "Linear webhook payloads by Connect event type: the `Linear-Event` header, then `.` and the body's `action`.",
        entries,
      ) +
      '\n' +
      envelopes +
      '\n' +
      emitter.declarations(),
  );
}

async function main(): Promise<void> {
  const flag = process.argv.indexOf('--cache-dir');
  const cacheDir = flag >= 0 ? process.argv[flag + 1] : undefined;
  await mkdir(OUT_DIR, { recursive: true });
  await generateGithub(cacheDir);
  await generateLinear(cacheDir);
  await generateIncidentIo(cacheDir);
  await generateJira(cacheDir);
}

await main();
