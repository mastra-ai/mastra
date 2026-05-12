### 13.3b Request Payloads

**Request payloads** are DTOs derived from the in-process option types. Values
that are live local objects, such as schemas, use explicit wire shapes instead
of crossing the process boundary directly. Example for `POST /messages`:

```ts
// JSON Schema Draft 2020-12 object. If `$schema` is omitted, the server treats
// the schema as Draft 2020-12. External `$ref` / `$dynamicRef`, non-JSON values,
// and schemas exceeding server size/depth/complexity limits reject before agent
// execution with `400 harness.validation`.
type JsonSchema = Record<string, JsonValue>;

type WireSchemaRef =
  | { schema: JsonSchema; schemaId?: never }
  | { schemaId: string; schema?: never };

interface WireSchemaDescriptor {
  schema: JsonSchema;
  // Optional server-owned alias. V1 does not add public schema-registration
  // routes or a durable schema table; products may expose IDs for schemas they
  // already register in config or through product-specific control planes.
  schemaId?: string;
}

// Request body — application/json
interface MessageRequest {
  content: string;
  files?: WireAttachment[];
  output?: WireSchemaRef;           // Not a local PublicSchema/Zod object.
  admissionId?: string;             // Optional retry/idempotency key for signal-driven message;
                                    // rejected when sync/output bypasses signals
  // Per-turn overrides
  model?: string;
  mode?: string;
  yolo?: boolean;
  // Product metadata only under `requestContext.app`. Direct-route validation
  // uses the §4.4 request-context allowlist before session admission.
  requestContext?: RequestContextInput;
  // addTools is not sendable over the wire — see §13.5
}

type WireAttachment =
  | { kind: 'inline'; name: string; mimeType: string; data: string /* base64 */ }
  | { kind: 'url'; name: string; mimeType: string; url: string }
  | { kind: 'ref'; name: string; mimeType: string; attachmentId: string };
```

Skill invocation uses the same attachment and serializable override rules, with
`skillName` carried by the route path:

```ts
interface SkillInvocationRequest {
  args?: Record<string, unknown>;
  files?: WireAttachment[];
  output?: WireSchemaRef;           // Same schema transport caveat as MessageRequest.
  admissionId?: string;             // Optional only when `output` is absent.
  model?: string;
  mode?: string;
  yolo?: boolean;
  // Same §4.4 request-context allowlist as MessageRequest.
  requestContext?: RequestContextInput;
  // addTools is not sendable over the wire — see §13.5
}
```

```ts
interface WireHarnessSkillDescriptor {
  name: string;
  description: string;
  instructions: string;
  argsSchema?: WireSchemaDescriptor;
  outputSchema?: WireSchemaDescriptor;
  defaultMode?: string;
  source: 'config' | 'workspace';
  filePath?: string;
}

interface WireListPage<T> {
  items: T[];
  nextCursor?: string;
  truncated: boolean;
}
```

`WireListPage<T>` is the default JSON envelope for cursor-bearing route
responses. Routes with a more specific read-model body, such as
`SessionActivityTimeline`, `SessionSnapshot.messages.recent`, or channel
diagnostics row-family pages, use their existing semantic item fields but still
follow the same `cursor` / `limit` / `nextCursor` / `truncated` behavior from
§4.4. Cursor tokens are opaque strings in query parameters and response bodies;
clients must not parse, persist as read-state, or reuse them across routes,
filters, resources, sessions, harnesses, or storage adapters.

The server serializes in-process `PublicSchema` values (including Zod-compatible
schemas) to JSON Schema Draft 2020-12 at the route boundary using the same
schema-compat conversion family as current Mastra server/tool serialization
(`toStandardSchema`, `standardSchemaToJSONSchema`, and `zodToJsonSchema` where
applicable). Raw HTTP clients send `WireSchemaRef`: either an inline JSON Schema
object or a `schemaId` previously advertised or otherwise registered by the
server for that authenticated harness/session context. Unknown or unauthorized
`schemaId` values reject with `400 harness.validation` before agent execution
and must not reveal whether the ID exists outside the caller's scope. Descriptor
routes return `WireHarnessSkillDescriptor` objects with JSON Schema descriptors;
they never return live schema instances, functions, classes, or SuperJSON-only
schema payloads. If a local schema-bearing descriptor cannot be converted, the
route fails rather than returning a descriptor that silently drops or misstates
the schema.

For untyped skill invocations, `admissionId` is passed to the underlying
signal-driven message admission after deterministic skill expansion. For typed
skill invocations (`output` present), the server rejects `admissionId` with
`harness.validation` because the call shares the non-retry-safe sync generate
path in v1.

For larger payloads, the route also accepts `multipart/form-data`: a JSON
`payload` part (containing the `MessageRequest` minus `files`) plus one file
part per attachment. The server promotes uploaded files into pre-stored
attachments and rewrites the message to use `kind: 'ref'` references before
durable admission. URL wire attachments follow §13.7: the URL is fetched/copied
into managed attachment storage and persisted as a ref before any replayable row
is written, or the request fails before admission.

The standalone pre-upload route is not a `WireAttachment` DTO. `POST
/harness/:name/sessions/:sessionId/attachments` accepts one
`multipart/form-data` file upload with the bytes plus `name` and `mimeType`
metadata, stages the Harness-owned bytes under the session, and returns JSON
`{ attachmentId: string }` for later `kind: 'ref'` message bodies.
