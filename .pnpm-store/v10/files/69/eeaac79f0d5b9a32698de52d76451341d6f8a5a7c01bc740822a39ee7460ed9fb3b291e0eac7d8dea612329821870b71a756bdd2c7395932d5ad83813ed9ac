"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { logMessage, logOutput, logWarning } from "../../bundler/log.js";
import { nextBackoff } from "./dev.js";
import chalk from "chalk";
import { stripVTControlCharacters } from "node:util";
import { format } from "node:util";
import { deploymentFetch } from "./utils/utils.js";
export class LogManager {
  constructor(mode) {
    this.mode = mode;
    __publicField(this, "paused", false);
  }
  async waitForUnpaused() {
    while (this.paused) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  beginDeploy() {
    if (this.mode === "pause-on-deploy") {
      this.paused = true;
    }
  }
  endDeploy() {
    if (this.mode === "pause-on-deploy") {
      this.paused = false;
    }
  }
}
const MAX_UDF_STREAM_FAILURE_COUNT = 5;
export async function logsForDeployment(ctx, credentials, options) {
  logMessage(chalk.yellow(`Watching logs${options.deploymentNotice}...`));
  await watchLogs(ctx, credentials.url, credentials.adminKey, "stdout", {
    history: options.history,
    success: options.success,
    jsonl: options.jsonl
  });
}
export async function watchLogs(ctx, url, adminKey, dest, options) {
  let numFailures = 0;
  let isFirst = true;
  let cursorMs = 0;
  for (; ; ) {
    try {
      const { entries, newCursor } = await pollUdfLog(
        ctx,
        cursorMs,
        url,
        adminKey
      );
      cursorMs = newCursor;
      numFailures = 0;
      await options?.logManager?.waitForUnpaused();
      if (isFirst) {
        isFirst = false;
        if (options?.history === true || typeof options?.history === "number" && options?.history > 0) {
          const entriesSlice = options?.history === true ? entries : entries.slice(entries.length - options?.history);
          processLogs(
            entriesSlice,
            (s) => logToDestination(dest, s),
            options?.success,
            options?.jsonl
          );
        }
      } else {
        processLogs(
          entries,
          (s) => logToDestination(dest, s),
          options?.success === true,
          options?.jsonl
        );
      }
    } catch {
      numFailures += 1;
    }
    if (numFailures > 0) {
      const backoff = nextBackoff(numFailures);
      if (numFailures > MAX_UDF_STREAM_FAILURE_COUNT) {
        logWarning(
          `Convex [WARN] Failed to fetch logs. Waiting ${backoff}ms before next retry.`
        );
      }
      await new Promise((resolve) => {
        setTimeout(() => resolve(null), backoff);
      });
    }
  }
}
async function pollUdfLog(ctx, cursor, url, adminKey) {
  const fetch = deploymentFetch(ctx, {
    deploymentUrl: url,
    adminKey
  });
  const response = await fetch(`/api/stream_function_logs?cursor=${cursor}`, {
    method: "GET"
  });
  return await response.json();
}
const prefixForSource = (udfType) => {
  return udfType.charAt(0);
};
function processLogs(rawLogs, write, shouldShowSuccessLogs, jsonl) {
  if (jsonl) {
    for (let i = 0; i < rawLogs.length; i++) {
      const log = rawLogs[i];
      write(JSON.stringify(log));
    }
    return;
  }
  for (let i = 0; i < rawLogs.length; i++) {
    const log = rawLogs[i];
    if (log.logLines) {
      const id = log.identifier;
      const udfType = log.udfType;
      const timestampMs = log.timestamp * 1e3;
      const executionTimeMs = "executionTime" in log ? log.executionTime * 1e3 : NaN;
      for (let j = 0; j < log.logLines.length; j++) {
        const formatted = formatLogLineMessage(
          "info",
          timestampMs,
          udfType,
          id,
          log.logLines[j]
        );
        write(formatted);
      }
      if ("error" in log && log.error) {
        const formatted = formatLogLineMessage(
          "error",
          timestampMs,
          udfType,
          id,
          log.error
        );
        write(formatted);
      } else if (log.kind === "Completion" && shouldShowSuccessLogs) {
        const formatted = chalk.green(
          formatFunctionExecutionMessage(
            timestampMs,
            udfType,
            id,
            executionTimeMs
          )
        );
        write(formatted);
      }
    }
  }
}
export function formatFunctionExecutionMessage(timestampMs, udfType, udfPath, executionTimeMs) {
  return `${prefixLog(timestampMs, udfType, udfPath)} Function executed in ${Math.ceil(executionTimeMs)} ms`;
}
export function formatLogLineMessage(type, timestampMs, udfType, udfPath, message) {
  const prefix = prefixForSource(udfType);
  if (typeof message === "string") {
    if (type === "info") {
      const match = message.match(/^\[.*?\] /);
      if (match === null) {
        return chalk.red(
          `[CONVEX ${prefix}(${udfPath})] Could not parse console.log`
        );
      }
      const level = message.slice(1, match[0].length - 2);
      const args = message.slice(match[0].length);
      return `${chalk.cyan(`${prefixLog(timestampMs, udfType, udfPath)} [${level}]`)} ${format(args)}`;
    } else {
      return chalk.red(
        `${prefixLog(timestampMs, udfType, udfPath)} ${message}`
      );
    }
  } else {
    const level = message.level;
    const formattedMessage = `${message.messages.join(" ")}${message.isTruncated ? " (truncated due to length)" : ""}`;
    return `${chalk.cyan(
      `${prefixLog(message.timestamp, udfType, udfPath)} [${level}]`
    )} ${formattedMessage}`;
  }
}
function logToDestination(dest, s) {
  switch (dest) {
    case "stdout":
      logOutput(s);
      break;
    case "stderr":
      logMessage(s);
      break;
  }
}
function prefixLog(timestampMs, udfType, udfPath) {
  const prefix = prefixForSource(udfType);
  const localizedTimestamp = new Date(timestampMs).toLocaleString();
  return `${localizedTimestamp} [CONVEX ${prefix}(${udfPath})]`;
}
export function formatLogsAsText(rawLogs, shouldShowSuccessLogs = false) {
  const lines = [];
  const write = (message) => lines.push(stripVTControlCharacters(message));
  processLogs(rawLogs, write, shouldShowSuccessLogs);
  return lines.join("\n");
}
//# sourceMappingURL=logs.js.map
