---
'@mastra/core': patch
---

Durable agents stop listening to the caller's abort signal once a run is released.

`stream()`, `recover()` and `generate()` forward a caller-supplied `abortSignal` onto the run's own controller by adding an `abort` listener to that signal. The listener was never removed, so it outlived the run. A caller that passes a composite signal — an idle loop's `AbortSignal.any([segmentSignal, budgetSignal])` — left Node holding that composite, and everything it reaches, including the finished run's session and request context, until it was garbage collected. Each turn of an idle loop with a run budget leaked one.

The three call sites now keep the `detach` returned by `createRunAbortController` and call it when the run's state is released, exactly as `resume()` already did. Aborting the caller's signal still stops a run that is still running; only a released run stops forwarding.
