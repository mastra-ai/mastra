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
 * downloaded ones are saved to it. It then runs `generate-event-types.ts`,
 * so the runtime event type lists match the new payload types.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

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
  openai: {
    file: 'openai-openapi.json',
    url: 'https://raw.githubusercontent.com/openai/openai-openapi/9246b543933df37e7c1b36cd81ff0dd7f1be5149/openapi.json',
  },
  resend: {
    file: 'resend-openapi.yaml',
    url: 'https://raw.githubusercontent.com/resend/resend-openapi/b762fefba49273a0fb42f7ffb7cad147f730bc59/resend.yaml',
  },
  clerk: {
    file: 'clerk-bapi.yaml',
    url: 'https://raw.githubusercontent.com/clerk/openapi-specs/690b7c3ce8bb2c39273cdcf4b46724525a78fcb5/bapi/2025-11-10.yml',
  },
  workos: {
    file: 'workos-openapi.yaml',
    url: 'https://raw.githubusercontent.com/workos/openapi-spec/1d41b5272463af84b6acdb0804a9b66e874dfa3a/spec/open-api-spec.yaml',
  },
  // WorkOS's events reference: which object each event's `data` is, and samples.
  workosEvents: { file: 'workos-events.md', url: 'https://workos.com/docs/events.md' },
  // ElevenLabs and Telegram publish no versioned URL either.
  elevenlabs: { file: 'elevenlabs-openapi.json', url: 'https://api.elevenlabs.io/openapi.json' },
  telegram: { file: 'telegram-bot-api.html', url: 'https://core.telegram.org/bots/api' },
} satisfies Record<string, Source>;

/**
 * Clerk's webhook events and the Backend API schema each one's `data` is, as
 * Clerk's own SDK maps them. Events whose data has no Backend API schema
 * (email, SMS, billing, directory sync, `user.merged`) are left out.
 */
const CLERK_WEBHOOKS_SOURCE =
  'https://github.com/clerk/javascript/blob/dc25c3b43b534544ae4ec3bcdd062f65277595ab/packages/backend/src/api/resources/Webhooks.ts';
const CLERK_EVENTS: Record<string, string> = {
  'user.created': 'User',
  'user.updated': 'User',
  'user.deleted': 'DeletedObject',
  'session.created': 'Session',
  'session.ended': 'Session',
  'session.removed': 'Session',
  'session.revoked': 'Session',
  'organization.created': 'Organization',
  'organization.updated': 'Organization',
  'organization.deleted': 'DeletedObject',
  'organizationDomain.created': 'OrganizationDomain',
  'organizationDomain.updated': 'OrganizationDomain',
  'organizationDomain.deleted': 'DeletedObject',
  'organizationMembership.created': 'OrganizationMembership',
  'organizationMembership.updated': 'OrganizationMembership',
  'organizationMembership.deleted': 'OrganizationMembership',
  'organizationInvitation.created': 'OrganizationInvitation',
  'organizationInvitation.accepted': 'OrganizationInvitation',
  'organizationInvitation.revoked': 'OrganizationInvitation',
  'role.created': 'Role',
  'role.updated': 'Role',
  'role.deleted': 'Role',
  'permission.created': 'Permission',
  'permission.updated': 'Permission',
  'permission.deleted': 'Permission',
  'waitlistEntry.created': 'WaitlistEntry',
  'waitlistEntry.updated': 'WaitlistEntry',
};

/**
 * WorkOS's webhook events and the API object each one's `data` is, as its
 * events reference names them. `dsync.group.user_*`,
 * `organization_domain.verification_failed` and `session.*` carry other
 * shapes, written out in `generateWorkos`.
 */
const WORKOS_EVENTS: Record<string, string> = {
  'connection.activated': 'Connection',
  'connection.deactivated': 'Connection',
  'connection.deleted': 'Connection',
  'dsync.activated': 'Directory',
  'dsync.deleted': 'Directory',
  'dsync.group.created': 'DirectoryGroup',
  'dsync.group.deleted': 'DirectoryGroup',
  'dsync.group.updated': 'DirectoryGroup',
  'dsync.user.created': 'DirectoryUser',
  'dsync.user.deleted': 'DirectoryUser',
  'dsync.user.updated': 'DirectoryUser',
  'user.created': 'UserlandUser',
  'user.updated': 'UserlandUser',
  'user.deleted': 'UserlandUser',
  'organization.created': 'Organization',
  'organization.updated': 'Organization',
  'organization.deleted': 'Organization',
  'organization_membership.created': 'UserlandUserOrganizationMembership',
  'organization_membership.updated': 'UserlandUserOrganizationMembership',
  'organization_membership.deleted': 'UserlandUserOrganizationMembership',
  'organization_domain.verified': 'OrganizationDomainStandAlone',
  'invitation.created': 'UserlandUserInvite',
  'invitation.accepted': 'UserlandUserInvite',
  'invitation.revoked': 'UserlandUserInvite',
};

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
  // Telegram's page ends with how long it took to render, which changes on every fetch.
  const stable = text.replace(/<!-- page generated in [\d.]+ms -->/g, '');
  return { text, sha256: createHash('sha256').update(stable).digest('hex') };
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
    // A contract's version can hold line breaks; each source stays on its comment line.
    ...sources.map(source => `// Source: ${source.replace(/\s+/g, ' ')}`),
    '',
    '',
  ].join('\n');
}

/** Formats a file the way the repo's `lint:format` check expects. */
function formatWithOxfmt(path: string): void {
  execFileSync('pnpm', ['exec', 'oxfmt', path], { stdio: 'inherit' });
}

async function emit(file: string, code: string): Promise<void> {
  const path = join(OUT_DIR, file);
  await writeFile(path, code);
  formatWithOxfmt(path);
  const formatted = await readFile(path, 'utf8');
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
  const next = () => {
    if (i >= tokens.length) throw new Error('Unexpected end of the GraphQL schema');
    return tokens[i++]!;
  };
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

// ---------------------------------------------------------------------------
// OpenAPI `webhooks` (OpenAI, Resend)

function parseDocument(source: Source, text: string): Schema {
  return (source.file.endsWith('.json') ? JSON.parse(text) : parseYaml(text, { maxAliasCount: -1 })) as Schema;
}

function componentSchemas(document: Schema): Record<string, Schema> {
  return (document.components as { schemas: Record<string, Schema> }).schemas;
}

/** The values a schema allows for one string property, through refs and unions. */
function propertyValues(document: Schema, schema: Schema, property: string): string[] {
  if (typeof schema.$ref === 'string') {
    const component = /^#\/components\/schemas\/(.+)$/.exec(schema.$ref)?.[1];
    const target = component && componentSchemas(document)[component];
    return target ? propertyValues(document, target, property) : [];
  }
  const value =
    isSchema(schema.properties) && isSchema(schema.properties[property]) ? schema.properties[property] : undefined;
  if (value && typeof value.const === 'string') return [value.const];
  if (value && Array.isArray(value.enum)) return value.enum.filter((item): item is string => typeof item === 'string');
  return ['oneOf', 'anyOf', 'allOf'].flatMap(key => {
    const branches = schema[key];
    return Array.isArray(branches)
      ? branches.filter(isSchema).flatMap(branch => propertyValues(document, branch, property))
      : [];
  });
}

/**
 * Types an OpenAPI 3.1 description's `webhooks`: each one's request body
 * schema, keyed by the single value its `type` property allows.
 */
async function generateOpenApiWebhooks(
  cacheDir: string | undefined,
  options: { source: Source; prefix: string; file: string; mapName: string; description: string },
): Promise<void> {
  const loaded = await load(options.source, cacheDir);
  const document = parseDocument(options.source, loaded.text);
  const webhooks = document.webhooks as Record<string, Record<string, Schema>>;
  const emitter = new OpenApiEmitter(document, options.prefix);
  const entries: Array<[string, string]> = [];

  for (const [name, operations] of Object.entries(webhooks)) {
    const requestBody = operations.post?.requestBody as Schema | undefined;
    const schema = (requestBody?.content as Record<string, { schema: Schema }> | undefined)?.['application/json']
      ?.schema;
    const ref = /^#\/components\/schemas\/(.+)$/.exec(String(schema?.$ref))?.[1];
    if (!ref) throw new Error(`${options.prefix} webhook ${name} has no component schema`);
    const types = [...new Set(propertyValues(document, schema!, 'type'))];
    if (types.length !== 1)
      throw new Error(`${options.prefix} webhook ${name} has types ${types.join(', ') || 'none'}`);
    entries.push([types[0]!, emitter.ref(ref)]);
  }
  if (entries.length === 0) throw new Error(`${options.prefix}'s description has no webhooks`);
  const duplicate = entries.find(([key], index) => entries.findIndex(([other]) => other === key) !== index);
  if (duplicate) throw new Error(`${options.prefix}'s description has two webhooks for ${duplicate[0]}`);

  await emit(
    options.file,
    header([options.source.url]) +
      mapInterface(options.mapName, options.description, entries) +
      '\n\n' +
      emitter.declarations(),
  );
}

// ---------------------------------------------------------------------------
// Clerk

async function generateClerk(cacheDir: string | undefined): Promise<void> {
  const loaded = await load(SOURCES.clerk, cacheDir);
  const document = parseDocument(SOURCES.clerk, loaded.text);
  const emitter = new OpenApiEmitter(document, 'Clerk');
  const entries = Object.entries(CLERK_EVENTS).map(([event, component]): [string, string] => [
    event,
    `ClerkWebhook<${JSON.stringify(event)}, ${emitter.ref(component)}>`,
  ]);

  const envelope = `
/** A Clerk webhook body: an event whose \`data\` is the Backend API object it concerns. */
export interface ClerkWebhook<Type extends string, Data> {
  type: Type;
  object: 'event';
  data: Data;
  event_attributes: {
    http_request: { client_ip: string; user_agent: string };
  };
  /** When the event happened, in milliseconds since the epoch. */
  timestamp: number;
  instance_id: string;
}
`;

  await emit(
    'clerk.generated.ts',
    header([SOURCES.clerk.url, `${CLERK_WEBHOOKS_SOURCE} (each event's data)`]) +
      mapInterface(
        'ClerkWebhookPayloads',
        "Clerk webhook payloads by Connect event type: the body's `type`.",
        entries,
      ) +
      '\n' +
      envelope +
      '\n' +
      emitter.declarations(),
  );
}

// ---------------------------------------------------------------------------
// WorkOS

/** The `data` of each sample event in WorkOS's events reference, by event. */
function workosSamples(markdown: string): Map<string, Record<string, unknown>> {
  const samples = new Map<string, Record<string, unknown>>();
  for (const match of markdown.matchAll(/```json[^\n]*\n([\s\S]*?)\n```/g)) {
    let sample: unknown;
    try {
      sample = JSON.parse(match[1]!);
    } catch {
      continue;
    }
    if (isSchema(sample) && typeof sample.event === 'string' && isSchema(sample.data)) {
      samples.set(sample.event, sample.data);
    }
  }
  return samples;
}

function sampleType(value: unknown): string {
  if (Array.isArray(value)) return 'unknown[]';
  if (value === null) return 'null';
  if (typeof value === 'object') return 'Record<string, unknown>';
  return ['string', 'number', 'boolean'].includes(typeof value) ? typeof value : 'unknown';
}

/**
 * The API object a WorkOS event's data corresponds to, as its sample in the
 * events reference shows it: required fields the sample leaves out (an
 * invitation's token, a deleted directory's external key) are omitted, and
 * fields only the sample has (an update's `previous_attributes`) are added,
 * typed from the sample, as optional.
 */
function workosDataType(
  emitter: OpenApiEmitter,
  schemas: Record<string, Schema>,
  component: string,
  sample: Record<string, unknown> | undefined,
): string {
  const name = emitter.ref(component);
  if (!sample) return name;
  const schema = schemas[component]!;
  const properties = isSchema(schema.properties) ? schema.properties : {};
  const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
  const missing = required.filter(key => !(key in sample));
  const extra = Object.keys(sample).filter(key => !(key in properties));
  let type = missing.length > 0 ? `Omit<${name}, ${union(missing.map(key => JSON.stringify(key)))}>` : name;
  if (extra.length > 0) {
    type += ` & { ${extra.map(key => `${propertyKey(key)}?: ${sampleType(sample[key])};`).join(' ')} }`;
  }
  return type;
}

async function generateWorkos(cacheDir: string | undefined): Promise<void> {
  const loaded = await load(SOURCES.workos, cacheDir);
  const reference = await load(SOURCES.workosEvents, cacheDir);
  const document = parseDocument(SOURCES.workos, loaded.text);
  const schemas = componentSchemas(document);
  const samples = workosSamples(reference.text);
  const emitter = new OpenApiEmitter(document, 'Workos');
  const data = (component: string, sample: unknown) =>
    workosDataType(emitter, schemas, component, isSchema(sample) ? sample : undefined);

  const shapes: Record<string, string> = Object.fromEntries(
    Object.entries(WORKOS_EVENTS).map(([event, component]) => [event, data(component, samples.get(event))]),
  );
  for (const event of ['dsync.group.user_added', 'dsync.group.user_removed']) {
    const sample = samples.get(event);
    shapes[event] =
      `{ directory_id: string; user: ${data('DirectoryUser', sample?.user)}; group: ${data('DirectoryGroup', sample?.group)} }`;
  }
  const failed = samples.get('organization_domain.verification_failed');
  shapes['organization_domain.verification_failed'] =
    `{ reason: string; organization_domain: ${data('OrganizationDomainStandAlone', failed?.organization_domain)} }`;
  shapes['session.created'] = 'WorkosSession';
  shapes['session.revoked'] = 'WorkosSession';

  const unsampled = Object.keys(shapes).filter(event => !samples.has(event));
  if (unsampled.length > 0) throw new Error(`WorkOS's events reference has no sample for ${unsampled.join(', ')}`);

  const entries = Object.entries(shapes).map(([event, type]): [string, string] => [
    event,
    `WorkosWebhook<${JSON.stringify(event)}, ${type}>`,
  ]);
  const envelope = `
/** A WorkOS webhook body. */
export interface WorkosWebhook<Event extends string, Data> {
  id: string;
  event: Event;
  data: Data;
  created_at: string;
  context?: Record<string, unknown>;
}

/** An AuthKit session, as the events reference shows it; the API has no session object. */
export interface WorkosSession {
  object: 'session';
  id: string;
  user_id: string;
  organization_id?: string;
  /** Present when the session was started by impersonation. */
  impersonator?: { email: string; reason: string | null };
  ip_address: string;
  user_agent: string;
  created_at: string;
  updated_at: string;
}
`;

  await emit(
    'workos.generated.ts',
    header([
      SOURCES.workos.url,
      `${SOURCES.workosEvents.url} (each event's data and samples; SHA-256 ${reference.sha256})`,
    ]) +
      mapInterface(
        'WorkosWebhookPayloads',
        "WorkOS webhook payloads by Connect event type: the body's `event`.",
        entries,
      ) +
      '\n' +
      envelope +
      '\n' +
      emitter.declarations(),
  );
}

// ---------------------------------------------------------------------------
// ElevenLabs

async function generateElevenlabs(cacheDir: string | undefined): Promise<void> {
  const loaded = await load(SOURCES.elevenlabs, cacheDir);
  const document = JSON.parse(loaded.text) as Schema;
  const info = isSchema(document.info) ? document.info : {};
  const emitter = new OpenApiEmitter(document, 'ElevenLabs');
  const conversation = emitter.ref('GetConversationResponseModel');

  const code =
    `${mapInterface(
      'ElevenLabsWebhookPayloads',
      "ElevenLabs post-call webhook payloads by Connect event type: the body's `type`.",
      [
        ['post_call_transcription', `ElevenLabsWebhook<'post_call_transcription', ElevenLabsWebhookConversation>`],
        ['post_call_audio', `ElevenLabsWebhook<'post_call_audio', ElevenLabsWebhookAudio>`],
        [
          'call_initiation_failure',
          `ElevenLabsWebhook<'call_initiation_failure', ElevenLabsWebhookCallInitiationFailure>`,
        ],
      ],
    )}

/** An ElevenLabs post-call webhook body. */
export interface ElevenLabsWebhook<Type extends string, Data> {
  type: Type;
  /** When the event occurred, in Unix seconds. */
  event_timestamp: number;
  data: Data;
}

/**
 * A finished conversation. The webhook reference doesn't list
 * \`has_auxiliary_audio\`, so it is optional here though the API's model
 * requires it.
 */
export type ElevenLabsWebhookConversation = Omit<${conversation}, 'has_auxiliary_audio'> &
  Partial<Pick<${conversation}, 'has_auxiliary_audio'>>;

/** A conversation's full audio, and nothing else. */
export interface ElevenLabsWebhookAudio {
  agent_id: string;
  conversation_id: string;
  branch_id?: string | null;
  version_id?: string | null;
  environment?: string | null;
  /** The conversation's audio, as base64-encoded MP3. */
  full_audio: string;
}

/** A telephony call that failed to start. */
export interface ElevenLabsWebhookCallInitiationFailure {
  agent_id: string;
  conversation_id: string;
  failure_reason: 'busy' | 'no-answer' | 'unknown';
  metadata: ElevenLabsWebhookSipFailure | ElevenLabsWebhookTwilioFailure;
}

export interface ElevenLabsWebhookSipFailure {
  type: 'sip';
  body: {
    /** Numbers in ElevenLabs' field table; its example sends ` +
    `-prefixed strings. */
    from_number: string | number;
    to_number: string | number;
    sip_status_code: number;
    error_reason: string;
    call_sid: string;
    twirp_code?: string;
    sip_status?: string;
  };
}

export interface ElevenLabsWebhookTwilioFailure {
  type: 'twilio';
  /** Twilio's StatusCallback body. */
  body: Record<string, unknown>;
}

${emitter.declarations()}`;

  await emit(
    'elevenlabs.generated.ts',
    header([
      `${SOURCES.elevenlabs.url} (version ${String(info.version)}, SHA-256 ${loaded.sha256})`,
      'https://elevenlabs.io/docs/agents-platform/workflows/post-call-webhooks (envelope, audio and failure data)',
    ]) + code,
  );
}

// ---------------------------------------------------------------------------
// Telegram

interface TelegramField {
  name: string;
  type: string;
  optional: boolean;
  description: string;
}

type TelegramDefinition =
  | { kind: 'object'; name: string; description: string; fields: TelegramField[] }
  | { kind: 'union'; name: string; description: string; members: string[] };

function htmlText(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The Bot API's types: each is an `<h4>` followed by a field table or a list of the types it can be. */
function parseTelegramTypes(html: string): Map<string, TelegramDefinition> {
  const definitions = new Map<string, TelegramDefinition>();
  const sections = html.split(/<h4>/).slice(1);
  for (const section of sections) {
    const end = section.search(/<h[34]>/);
    const body = end < 0 ? section : section.slice(0, end);
    const name = htmlText(body.slice(0, body.indexOf('</h4>')));
    // Types are PascalCase; methods are camelCase.
    if (!/^[A-Z][A-Za-z0-9]+$/.test(name)) continue;
    const description = htmlText(body.match(/<p>([\s\S]*?)<\/p>/)?.[1] ?? '');
    const table = body.match(/<table class="table">([\s\S]*?)<\/table>/)?.[1];
    if (table && /<th>Field<\/th>/.test(table)) {
      const fields = [
        ...table.matchAll(/<tr>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/g),
      ].map(
        ([, field, type, text]): TelegramField => ({
          name: htmlText(field!),
          type: htmlText(type!),
          optional: /^<em>Optional<\/em>/.test(text!.trim()),
          description: htmlText(text!).replace(/^Optional\. /, ''),
        }),
      );
      definitions.set(name, { kind: 'object', name, description, fields });
      continue;
    }
    const list = body.match(/<ul>([\s\S]*?)<\/ul>/)?.[1];
    const items = list ? [...list.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(m => m[1]!.trim()) : [];
    const members = items.flatMap(item => item.match(/^<a href="#[a-z0-9]+">([A-Z][A-Za-z0-9]+)<\/a>$/)?.[1] ?? []);
    if (members.length > 0 && members.length === items.length) {
      // RichText can also be "a String ... an Array of RichText".
      if (/\ba String\b/.test(description)) members.push('String');
      const array = description.match(/\ban Array of ([A-Z][A-Za-z0-9]+)/)?.[1];
      if (array) members.push(`Array of ${array}`);
      definitions.set(name, { kind: 'union', name, description, members });
    } else {
      // Placeholders such as CallbackGame "hold no information".
      definitions.set(name, { kind: 'object', name, description, fields: [] });
    }
  }
  return definitions;
}

class TelegramEmitter {
  readonly #definitions: Map<string, TelegramDefinition>;
  readonly #queued = new Set<string>();
  readonly #queue: string[] = [];

  constructor(definitions: Map<string, TelegramDefinition>) {
    this.#definitions = definitions;
  }

  ref(name: string): string {
    if (!this.#definitions.has(name)) throw new Error(`Unknown Telegram type ${name}`);
    if (!this.#queued.has(name)) {
      this.#queued.add(name);
      this.#queue.push(name);
    }
    return `Telegram${name}`;
  }

  type(field: TelegramField): string {
    // A field documented as always one value is a discriminant.
    const always = field.description.match(/(?:always|must be) [“"]([^”"]+)[”"]/);
    if (always && field.type === 'String') return JSON.stringify(always[1]);
    return this.#type(field.type);
  }

  #type(text: string): string {
    const array = text.match(/^Array of (.+)$/);
    if (array) return `${wrap(this.#type(array[1]!))}[]`;
    if (/ or /.test(text) || /, /.test(text)) {
      return union(text.split(/ or |, /).map(part => this.#type(part.trim())));
    }
    switch (text) {
      case 'Integer':
      case 'Float':
      case 'Float number':
        return 'number';
      case 'String':
        return 'string';
      case 'Boolean':
        return 'boolean';
      case 'True':
        return 'true';
      case 'False':
        return 'false';
    }
    return this.ref(text);
  }

  declarations(): string {
    const out: string[] = [];
    for (let i = 0; i < this.#queue.length; i++) {
      const definition = this.#definitions.get(this.#queue[i]!)!;
      const name = `Telegram${definition.name}`;
      if (definition.kind === 'union') {
        const members = definition.members.map(member => this.#type(member));
        out.push(`${doc(definition.description)}export type ${name} = ${members.join(' | ')};`);
      } else if (definition.fields.length === 0) {
        out.push(`${doc(definition.description)}export type ${name} = Record<string, never>;`);
      } else {
        const fields = definition.fields
          .map(
            field =>
              `${doc(field.description)}${propertyKey(field.name)}${field.optional ? '?' : ''}: ${this.type(field)};`,
          )
          .join('\n');
        out.push(`${doc(definition.description)}export interface ${name} {\n${fields}\n}`);
      }
    }
    return out.join('\n\n');
  }
}

async function generateTelegram(cacheDir: string | undefined): Promise<void> {
  const loaded = await load(SOURCES.telegram, cacheDir);
  const version = loaded.text.match(/Bot API (\d+\.\d+)/)?.[1];
  if (!version) throw new Error("Couldn't find the Bot API version in Telegram's reference");
  const definitions = parseTelegramTypes(loaded.text);
  const update = definitions.get('Update');
  if (update?.kind !== 'object') throw new Error("Telegram's reference has no Update type");
  const emitter = new TelegramEmitter(definitions);

  // One event per update kind: every optional field besides update_id.
  const kinds = update.fields.filter(field => field.name !== 'update_id');
  if (kinds.some(field => !field.optional)) throw new Error('Expected every Update kind to be optional');
  const entries = kinds.map((field): [string, string] => [
    field.name,
    `TelegramWebhook<${JSON.stringify(field.name)}, ${emitter.type(field)}>`,
  ]);

  await emit(
    'telegram.generated.ts',
    header([`${SOURCES.telegram.url} (Bot API ${version}, SHA-256 ${loaded.sha256})`]) +
      mapInterface(
        'TelegramWebhookPayloads',
        'Telegram webhook payloads by Connect event type: the kind of update, the one field it carries besides `update_id`.',
        entries,
      ) +
      `

/** A Telegram update of one kind. */
export type TelegramWebhook<Kind extends string, Value> = { update_id: number } & { [K in Kind]: Value };

` +
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
  await generateOpenApiWebhooks(cacheDir, {
    source: SOURCES.openai,
    prefix: 'OpenAi',
    file: 'openai.generated.ts',
    mapName: 'OpenAiWebhookPayloads',
    description: "OpenAI webhook payloads by Connect event type: the body's `type`.",
  });
  await generateOpenApiWebhooks(cacheDir, {
    source: SOURCES.resend,
    prefix: 'Resend',
    file: 'resend.generated.ts',
    mapName: 'ResendWebhookPayloads',
    description: "Resend webhook payloads by Connect event type: the body's `type`.",
  });
  await generateClerk(cacheDir);
  await generateWorkos(cacheDir);
  await generateElevenlabs(cacheDir);
  await generateTelegram(cacheDir);
  const types = spawnSync('pnpm', ['exec', 'tsx', 'scripts/generate-event-types.ts'], {
    cwd: PACKAGE_ROOT,
    stdio: 'inherit',
  });
  if (types.status !== 0) throw new Error('generate-event-types.ts failed');
}

await main();
