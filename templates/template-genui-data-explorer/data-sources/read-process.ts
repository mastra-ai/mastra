import type { Serializable } from "node:child_process";
import { fork } from "node:child_process";
import { SourceError } from "./source.ts";
import type { SourceExecutionContext } from "./source.ts";

/** Trusted adapters use a disposable process so native synchronous reads can be stopped. */
export async function runReadProcess<T>(
  worker: URL,
  input: unknown,
  context: SourceExecutionContext,
): Promise<T> {
  if (context.signal.aborted) throw context.signal.reason;
  const child = fork(worker, [], { execArgv: [], stdio: ["ignore", "ignore", "ignore", "ipc"] });
  let result: T | undefined;
  let failure: unknown;
  let received = false;
  let resolveClosed!: () => void;
  const closed = new Promise<void>((resolve) => {
    resolveClosed = resolve;
  });
  context.trackCleanup?.(closed);
  const stop = (reason: unknown) => {
    failure ??= reason;
    child.kill("SIGKILL");
  };
  const abort = () =>
    stop(context.signal.reason ?? new SourceError("cancelled", "Analysis cancelled."));
  const timer = setTimeout(
    () =>
      stop(
        new SourceError(
          "timeout",
          "The source read exceeded its deadline. Retry a smaller analysis.",
        ),
      ),
    Math.max(1, context.deadline - Date.now()),
  );
  child.on("error", () =>
    stop(
      new SourceError(
        "source-unavailable",
        "The source worker could not start. Retry after checking local setup.",
      ),
    ),
  );
  child.on("message", (message: unknown) => {
    if (received || failure) return;
    if (!message || typeof message !== "object" || !("ok" in message)) {
      stop(new SourceError("invalid-result", "The source worker returned invalid data."));
      return;
    }
    received = true;
    if (message.ok === true && "result" in message) result = message.result as T;
    else if ("code" in message && typeof message.code === "string") {
      const code = message.code;
      failure = new SourceError(
        code === "incomplete-result" || code === "source-unavailable" ? code : "invalid-input",
        "message" in message && typeof message.message === "string"
          ? message.message
          : "The source could not execute this analysis.",
      );
    } else
      failure = new SourceError(
        "source-unavailable",
        "The source read failed. Check the dataset and retry.",
      );
    // The worker exits after flushing its reply; wait for its actual close.
  });
  child.once("close", () => {
    clearTimeout(timer);
    context.signal.removeEventListener("abort", abort);
    resolveClosed();
  });
  context.signal.addEventListener("abort", abort, { once: true });
  if (context.signal.aborted) abort();
  else child.send(input as Serializable);
  await closed;
  if (failure) throw failure;
  if (!received || result === undefined)
    throw new SourceError(
      "source-unavailable",
      "The source worker stopped without a complete result.",
    );
  return result;
}
