---
'@mastra/core': patch
---

Make scorer sampling deterministic and tie it to the trace sampling decision

Ratio-based scorer sampling previously called `Math.random()` on every scorer invocation. It
now hashes the trace ID (falling back to the run ID when observability is not configured), so
the decision is reproducible and every scorer at a given rate selects the same traces. Two
scorers sampling at 10% now cover the same 10% of traffic instead of overlapping on roughly 1%
by chance, which makes their scores comparable on the same population.

Scorers also now respect the tracing sampler. If the tracer declined a trace, scorers no
longer run against it — those scores referenced a trace that was never stored and could not be
drilled into.

Two changes in behavior to be aware of when upgrading:

- **Score volume drops if your trace sampling rate is lower than your scorer sampling rate.**
  The scores you lose are ones whose traces were never recorded. If you rely on scores for
  traffic you deliberately do not trace, lower your trace sampling deliberately or raise it to
  cover the traffic you score.
- **Which traces get scored changes, even at an unchanged rate.** Score counts before and
  after the upgrade are drawn from a different set of traces, not just a different number.

Scoring is unaffected when observability is not configured: with no tracing set up there is no
trace decision to inherit, so scorers run as before, now keyed deterministically on run ID.
