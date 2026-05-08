### 4.4 Operation option types

The three operation primitives share a common shape. All extend `HarnessOverrides`.

```ts
interface MessageOptions<S extends ZodSchema | undefined = undefined> extends HarnessOverrides {
  content: string;
  files?: FileAttachment[];
  // `output` requires `sync: true`. Together they call agent.generate() on
  // a fresh runId and bypass the signal pathway (typed extraction needs a
  // committed turn boundary). This is the only message form that can throw
  // HarnessBusyError.
  output?: S;
  sync?: boolean;
  // `stream: true` returns AgentStream synchronously. The stream represents
  // the turn that answers this signal. Mutually exclusive with `output`.
  stream?: boolean;
  requestContext?: RequestContextInput;
  tracingContext?: TracingContext;
  tracingOptions?: TracingOptions;
}

// `QueueOptions` deliberately omits `addTools`. Queued items are durable —
// they survive server restarts and replay from `SessionRecord.pendingQueue`
// — and tool implementations are closures that cannot be serialised. Letting
// callers pass `addTools` here would mean the post-restart replay runs with
// a different tool surface than the caller requested, silently. Callers that
// need a custom tool surface for a one-shot turn should use `message(...)`
// on an idle thread (or `useSkill(...)`), where the override is bound to a
// run that lives in memory for its full lifetime. See §4.3 and §5.7.
interface QueueOptions extends Omit<HarnessOverrides, 'addTools'> {
  content: string;
  files?: FileAttachment[];
  requestContext?: RequestContextInput;
  tracingContext?: TracingContext;
  tracingOptions?: TracingOptions;
}

interface UseSkillOptions<S extends ZodSchema | undefined = undefined> extends HarnessOverrides {
  args?: Record<string, unknown>;   // injected into the skill prompt
  files?: FileAttachment[];
  output?: S;                       // typed result
  requestContext?: RequestContextInput;
  tracingContext?: TracingContext;
  tracingOptions?: TracingOptions;
}

// File attachments. Two forms:
//   - Inline: bytes in-memory, harness flushes them to the attachment store
//     before queuing (so the queue item survives a server restart).
//   - URL: already-hosted asset (S3, signed CDN URL, etc.); stored as-is.
//
// Pre-uploaded inline files reference a previously-stored attachment by ID
// (see HarnessStorage.saveAttachment in §5.2 and the wire protocol in §13).
type FileAttachment =
  | {
      kind: 'inline';
      name: string;
      mimeType: string;
      data: Uint8Array;
    }
  | {
      kind: 'url';
      name: string;
      mimeType: string;
      url: string;
    }
  | {
      kind: 'ref';
      name: string;
      mimeType: string;
      attachmentId: string;            // reference to a previously-stored attachment
    };
```

Inline attachments larger than `HarnessConfig.files.maxInlineBytes` (default 10 MiB; see §9) are rejected at the entry point — callers must pre-upload via the file route or use a URL form.
