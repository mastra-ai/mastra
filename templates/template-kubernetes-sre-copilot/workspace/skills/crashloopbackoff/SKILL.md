---
name: crashloopbackoff
description: Diagnostic checklist for Pods stuck in CrashLoopBackOff
version: 1.0.0
metadata:
  tags:
    - kubernetes
    - pod-failure
    - crashloopbackoff
---

# CrashLoopBackOff

A container is starting, exiting, and being restarted by the kubelet on an exponential backoff.
The goal is to find out *why* the container exits, not just confirm that it does.

## Diagnostic Checklist

1. **Get the Pod.** Confirm `status.phase`, `containerStatuses[].state.waiting.reason`
   (`CrashLoopBackOff`), and `restartCount`. A high `restartCount` with a low pod age means it's
   failing fast and repeatedly — that's the pattern to explain.
2. **Describe the Pod.** Read `containerStatuses[].lastState.terminated` for the previous
   container instance: `exitCode`, `reason`, `startedAt`/`finishedAt`. The exit code narrows the
   cause:
   - `0` — the process exited cleanly. Usually a misconfigured entrypoint/command, or a process
     that isn't meant to be long-running (missing `command: ["tail", "-f", ...]` etc.).
   - `1` — generic application error. Go to logs.
   - `137` — SIGKILL, almost always OOMKilled. This is a different failure type — reclassify and
     hand off to the OOMKilled checklist instead of continuing here.
   - `139` — segfault (SIGSEGV). Native code / binary issue, not application logic.
   - `143` — SIGTERM, often a graceful shutdown that took too long and got killed on the second
     signal, or a liveness probe kill.
3. **Fetch recent Events for the Pod.** Look for `BackOff`, `Failed`, `Unhealthy` (liveness probe
   failures causing kubelet-initiated restarts look identical to app crashes from the outside —
   events disambiguate the two), and `FailedMount`/`FailedScheduling` noise that might be a
   red herring.
4. **Fetch the previous container's logs** (`previous=true`). This is the single most important
   piece of evidence — the *current* container's logs are usually empty because it just started.
   Look for the last few lines before exit: stack traces, "connection refused" to a dependency,
   config/env var errors, missing file errors.
5. **Cross-check readiness/liveness probes** on the Pod spec. If a probe is too aggressive
   (short `initialDelaySeconds` on a slow-starting app), the kubelet itself is the one killing the
   container — the "crash" is the probe, not the application.

## Classification Rule

Root cause is a genuine application crash only if: exit code is non-zero (or the process
legitimately exited when it shouldn't have), the previous logs show a clear failure signal, and
there is no liveness-probe-triggered `Killing` event immediately preceding the exit. Otherwise,
the root cause is the probe configuration, not the application.

## Confidence Guidance

- **High (0.8+):** Previous logs show an explicit unhandled exception/stack trace matching the
  exit reason, and no probe events precede it.
- **Medium (0.4–0.79):** Exit code and events are consistent with a cause, but previous logs are
  empty, truncated, or ambiguous.
- **Low (<0.4):** Conflicting signals (e.g. exit code 0 but events suggest an OOM) — say so
  explicitly in `rootCause` rather than guessing.
