### 4.8d Remote-Safe Supporting Types

```ts
// Remote-safe skill reads cannot expose local schema implementation objects.
// In-process callers that need raw PublicSchema objects narrow to Session and
// read HarnessSkill; portable callers handle this descriptor shape.
interface RemoteSafeSkillDescriptor
  extends Omit<HarnessSkill, 'argsSchema' | 'outputSchema'> {
  argsSchema?: WireSchemaDescriptor;
  outputSchema?: WireSchemaDescriptor;
}

type RemoteMessageOptions<S extends PublicSchema | undefined = undefined> =
  Omit<MessageOptions<S>, 'addTools'>;

type RemoteUseSkillOptions<S extends PublicSchema | undefined = undefined> =
  Omit<UseSkillOptions<S>, 'addTools'>;

interface RemoteSafePermissions {
  grantCategory(opts: { category: ToolCategory }): Promise<void>;
  grantTool(opts: { toolName: string }): Promise<void>;
  revokeCategory(opts: { category: ToolCategory }): Promise<void>;
  revokeTool(opts: { toolName: string }): Promise<void>;
  getGrants(): Awaitable<Readonly<SessionGrants>>;
  setPolicy(opts: { category: ToolCategory; policy: PermissionPolicy }): Promise<void>;
  setPolicy(opts: { toolName: string; policy: PermissionPolicy }): Promise<void>;
  getRules(): Awaitable<Readonly<PermissionRules>>;
}

interface ObservationalMemorySnapshot {
  id: string;
  scope: 'thread' | 'resource';
  resourceId: string;
  threadId: string | null;
  createdAt: number;
  updatedAt: number;
  lastObservedAt?: number;
  originType: 'initial' | 'reflection';
  generationCount: number;

  // Active observation text is caller-visible memory content. It is returned
  // only after the session/resource check has passed and may summarize other
  // threads for the same resource when `scope === 'resource'`. The string is a
  // bounded, redacted public projection; it may be empty when no scoped
  // observation exists or when policy redacts/truncates the underlying text.
  activeObservations: string;

  // Advisory progress counters. These are not settlement, lease, or recovery
  // proof and can lag the durable message log.
  totalTokensObserved: number;
  observationTokenCount: number;
  pendingMessageTokens: number;
  isObserving: boolean;
  isReflecting: boolean;
  isBufferingObservation: boolean;
  isBufferingReflection: boolean;

  // Resolved JSON-safe config view. Live model objects, functions, provider
  // client handles, raw config blobs, metadata, buffered chunks/reflections,
  // and history generations are not part of the public snapshot.
  observerModelId: string | null;
  reflectorModelId: string | null;
  observationThreshold: number;
  reflectionThreshold: number;
}

interface RemoteSafeObservationalMemory {
  getObserverModelId(): Awaitable<string | null>;
  getReflectorModelId(): Awaitable<string | null>;
  getObservationThreshold(): Awaitable<number>;
  getReflectionThreshold(): Awaitable<number>;
  switchObserverModel(opts: { model: string }): Promise<void>;
  switchReflectorModel(opts: { model: string }): Promise<void>;
  getRecord(): Promise<ObservationalMemorySnapshot | null>;
  loadProgress(): Promise<void>;
}

```
