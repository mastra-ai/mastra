# Pulse Observability Exploration

Exploring a unified "pulse" event model to replace the traditional logs/metrics/spans
observability stack. The core thesis: observability designed for human dashboards doesn't
serve an agent-native world where the primary consumer is another LLM.

## Documents

| File | Description |
|------|-------------|
| [00-original-exploration.md](./00-original-exploration.md) | Initial exploration notes — problem statement, pulse concept, comparisons |
| [01-current-system-anatomy.md](./01-current-system-anatomy.md) | Detailed inventory of the existing Mastra observability system |
| [02-design-tensions.md](./02-design-tensions.md) | Key design decisions that need resolving before prototyping |
| [sketches/](./sketches/) | TypeScript code sketches for exploring ideas (not implementation) |

## Status

**Active exploration** — no implementation. Writing markdown and code sketches to think
through the design space.

## Key insight

A "pulse" is the atomic unit of observability. Everything that happens — a log, a span
start/end, a metric, a score — is just a pulse: an event at a point in time, with data
attached, connected to other pulses via parent references. Delta encoding means only new
information is stored with each pulse.
