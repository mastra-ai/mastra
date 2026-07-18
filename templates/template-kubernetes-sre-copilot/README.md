# Kubernetes SRE Copilot

A read-only Kubernetes SRE copilot built with [Mastra](https://mastra.ai/) that diagnoses the four
most common Pod failure patterns — CrashLoopBackOff, ImagePullBackOff, OOMKilled, and
Pending/PVC-stuck — and returns a structured, auditable diagnosis instead of a paragraph of prose.

## Why we built this

Most "AI + Kubernetes" demos let you chat with your cluster. None of them encode a structured
diagnostic process, enforce safety boundaries on writes, or produce evidence you can verify —
they give you a verdict and ask you to trust it. SRE teams don't work that way: they trust a chain
of evidence, not an assertion.

This template encodes _how experienced SREs actually debug_ these four failure patterns as
editable runbooks (`workspace/skills/*/SKILL.md`), runs a fixed diagnostic workflow per failure
type instead of letting a model free-associate over cluster state, and returns every diagnosis as
an **evidence graph** — each claim in the output traces back to the specific tool call that
produced it.

```text
Service Unavailable
  → Deployment not Ready
    → Pod CrashLoopBackOff
      → Container Exit Code 137
        → OOMKilled Event
          → Memory Limit: 128Mi
            → Recommendation: increase to 512Mi
```

## Architecture

```text
User
  ↓
Mastra Agent (read-only instructions, no write tools registered)
  ↓
MCPClient → kubernetes-mcp-server (github.com/containers/kubernetes-mcp-server), launched with --read-only
  ↓
Router step: classify failure type from Pod status
  ↓
Fixed-step diagnostic workflow (one checklist per failure type, from workspace/skills/*/SKILL.md)
  ↓
Structured Zod-typed output: root cause, evidence chain, confidence, suggested fix (text only, never executed)
```

Cluster access goes exclusively through
[`kubernetes-mcp-server`](https://github.com/containers/kubernetes-mcp-server) — an existing,
independently maintained MCP server — via `@mastra/mcp`'s `MCPClient`. This template does not wrap
`kubectl` and does not talk to the Kubernetes API directly.

**Read-only by architecture, not by prompt instruction.** The MCP server is launched with
`--read-only`, which rejects every write operation (create, update, delete, exec, scale) at the
server itself. A second, redundant policy gate (`src/mastra/lib/policy.ts`) filters and classifies
every tool call client-side before it reaches the server. Neither the chat agent nor the workflow
has a single write tool registered anywhere — there's nothing to remove to make this safe, because
nothing unsafe was ever wired in.

## Prerequisites

- Node.js >= 22.13.0
- Access to a Kubernetes cluster and a working `kubeconfig` (a local cluster via Docker Desktop's
  Kubernetes, kind, or minikube works fine for trying this out)
- An [OpenAI API Key](https://platform.openai.com/api-keys)
- `npx` available on your PATH (used to launch `kubernetes-mcp-server` — no separate install
  required, see [Getting started](#getting-started))

## Getting started

```shell
npm install
cp .env.example .env
```

Fill in your `.env`:

```dotenv
OPENAI_API_KEY=sk-...
# Optional — omit to use your default kubeconfig / in-cluster config
KUBECONFIG=
# Optional — point at an already-running kubernetes-mcp-server instead of launching one via npx
KUBE_MCP_SERVER_URL=
```

Start the dev server:

```shell
npm run dev
```

Open [http://localhost:4111](http://localhost:4111) to access Mastra Studio. On first run, the
server launches `kubernetes-mcp-server` (installed as a pinned dependency by `npm install` above,
via `npx kubernetes-mcp-server --read-only`) automatically — no separate install step, and no
unpinned network fetch on every dev start.

## Usage

### Agent (Chat)

Open the **Kubernetes SRE Copilot** agent and give it a Pod:

```
Diagnose payment-service-7d4f8b9c6-x2mqp in the checkout namespace
```

The agent fetches the Pod, classifies the failure type, follows the matching workspace runbook,
and returns a structured diagnosis with an evidence chain. Working memory keeps track of the
namespace/cluster context so a follow-up like "check it again" doesn't require re-specifying
scope; observational memory compresses large log/event dumps between turns so a chatty CrashLoop
with pages of stack trace doesn't blow out the context window.

### Workflow

Open the **Workflows** tab and run **diagnosis-workflow** with `namespace` and `podName` inputs
(and optionally `context` for a specific kubeconfig context). The workflow runs the fixed pipeline
— fetch, classify, branch into the matching checklist, report — and returns the same structured
JSON diagnosis, useful for calling from CI, an alert webhook, or your own UI without going through
chat.

## Customization

### Change diagnostic runbooks

Edit the files in `workspace/skills/`. Each `SKILL.md` defines the checklist for one failure type
— what to check, in what order, how to weigh conflicting signals, and how to set the confidence
score. The workflow's "classify cause" step reads directly from the matching file; editing the
runbook changes the diagnosis without touching any TypeScript.

### Add a failure type not yet covered

1. Add a new `workspace/skills/<name>/SKILL.md` following the format of the existing four.
2. Add the failure type to `failureTypeSchema` in `src/mastra/lib/schemas.ts`.
3. Add a classification pattern to `CLASSIFICATION_PATTERNS` in
   `src/mastra/workflows/diagnosis-workflow.ts`.
4. Add a `createStep` that gathers the evidence your new checklist calls for (mirror
   `diagnoseCrashLoop` or one of the others) and a new `.branch()` arm dispatching to it.

### Point at a different Kubernetes MCP server

`src/mastra/mcp/k8s-mcp-client.ts` launches `kubernetes-mcp-server` locally via `npx` by default.
Set `KUBE_MCP_SERVER_URL` to point at a remote instance instead (e.g. one deployed via that
project's Helm chart with `read_only = true` set in its own config, for production use where you
want read-only enforced at the server regardless of how the client is launched). If you swap to a
different Kubernetes MCP server implementation entirely, update `READ_ONLY_TOOL_NAMES` in the same
file to match its actual read-tool names.

### Swap models

Change the `model` field in the agent files. `sre-agent.ts` uses `openai/gpt-5.2` for the
interactive chat agent; `workflow-diagnosis-agent.ts` also defaults to `gpt-5.2` since diagnosis
quality is this template's core value — swap to `gpt-5-mini` there if you want faster/cheaper
workflow runs and are fine trading off some synthesis quality. Any provider Mastra supports
(Anthropic, OpenAI, others) works — just match the `model` string format and the corresponding
API key env var.

## Non-Goals (v1)

Stated explicitly so scope is clear to reviewers and contributors:

- **No write/remediation actions** (scale, restart, delete) — not even behind approval, in v1.
- **No multi-agent orchestration / coordinator architecture.**
- **No autonomous incident response** ("alert → diagnose → execute → close").
- **No custom `kubectl` wrapping** — all cluster access goes through the existing, independently
  audited `kubernetes-mcp-server`.

## Testing status

Verified against a real cluster, not just type-checked. `tsc --noEmit` passes clean, and the
template was run end-to-end against a local Docker Desktop Kubernetes cluster (`kind` provider)
with one Pod seeded per failure type in a dedicated namespace: a container that exits immediately
(CrashLoopBackOff), a Pod referencing a nonexistent image tag (ImagePullBackOff), a container with
a memory limit far below its actual allocation (OOMKilled), and a Pod referencing a PVC bound to a
nonexistent StorageClass (PVCPending). For all four: the router classified the failure type
correctly, every branch's tool calls against the real `kubernetes-mcp-server` succeeded, and the
returned diagnosis was independently confirmed correct against the pod's actual raw status, not
just structurally well-formed.

Two real bugs were found and fixed during this pass, both worth knowing about if you're extending
this template: `kubernetes-mcp-server` returns pod/resource data as YAML text, not JSON — code
that parses tool output with a JSON-shaped regex (quoted keys) will silently match nothing against
real output. And bundling (`mastra dev`/`mastra build` via esbuild) flattens all source into a
single file at `.mastra/output/`, so any code resolving a path relative to `import.meta.dirname`
must account for the bundle's own directory depth, not the original source file's depth — see the
comment in `src/mastra/lib/skills.ts` for the specific fix.

Not yet tested: multi-node clusters, RBAC-restricted ServiceAccounts, and OpenShift.

## Roadmap

Not shipped — direction only, listed here so it's visible without being implied by the code:

- **Phase 4:** Write actions (scale, restart — never delete) behind mandatory human approval.
- **Phase 5:** Multi-agent architecture (coordinator + specialist agents per failure domain).
- **Phase 6:** Autonomous incident mode (alert → diagnose → execute → verify → close).

None of this is committed or in progress. Building it would be a different project, months out —
this template ships v1 only.

## About Mastra templates

[Mastra templates](https://mastra.ai/templates) are ready-to-use projects that show off what you
can build — clone one, poke around, and make it yours. They live in the
[Mastra monorepo](https://github.com/mastra-ai/mastra) and are automatically synced to standalone
repositories for easier cloning.

Want to contribute? See
[CONTRIBUTING.md](https://github.com/mastra-ai/mastra/blob/main/templates/template-kubernetes-sre-copilot/CONTRIBUTING.md).
