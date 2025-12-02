"use strict";
import {
  logFailure,
  logFinishedStep,
  logMessage,
  logVerbose,
  logWarning
} from "../../bundler/log.js";
import chalk from "chalk";
import * as net from "net";
import * as dns from "dns";
import * as crypto from "crypto";
import {
  bareDeploymentFetch,
  formatDuration,
  formatSize,
  ThrowingFetchError
} from "./utils/utils.js";
import ws from "ws";
import { BaseConvexClient } from "../../browser/index.js";
import { DefaultLogger } from "../../browser/logging.js";
const ipFamilyNumbers = { ipv4: 4, ipv6: 6, auto: 0 };
const ipFamilyNames = { 4: "ipv4", 6: "ipv6", 0: "auto" };
export async function runNetworkTestOnUrl(ctx, { url, adminKey }, options) {
  await checkDns(ctx, url);
  await checkTcp(ctx, url, options.ipFamily ?? "auto");
  await checkHttp(ctx, url);
  await checkWs(ctx, { url, adminKey });
  await checkEcho(ctx, url, 128);
  await checkEcho(ctx, url, 4 * 1024 * 1024);
  if (options.speedTest) {
    await checkEcho(ctx, url, 64 * 1024 * 1024);
  }
  logFinishedStep("Network test passed.");
}
async function checkDns(ctx, url) {
  try {
    const hostname = new URL("/", url).hostname;
    const start = performance.now();
    const result = await new Promise((resolve, reject) => {
      dns.lookup(hostname, (err, address, family) => {
        if (err) {
          reject(err);
        } else {
          resolve({ duration: performance.now() - start, address, family });
        }
      });
    });
    logMessage(
      `${chalk.green(`\u2714`)} OK: DNS lookup => ${result.address}:${ipFamilyNames[result.family]} (${formatDuration(result.duration)})`
    );
  } catch (e) {
    return ctx.crash({
      exitCode: 1,
      errorType: "transient",
      printedMessage: `FAIL: DNS lookup (${e})`
    });
  }
}
async function checkTcp(ctx, urlString, ipFamilyOpt) {
  const url = new URL(urlString);
  if (url.protocol === "http:") {
    const port = Number.parseInt(url.port || "80");
    await checkTcpHostPort(ctx, url.hostname, port, ipFamilyOpt);
  } else if (url.protocol === "https:") {
    const port = Number.parseInt(url.port || "443");
    await checkTcpHostPort(ctx, url.hostname, port, ipFamilyOpt);
    if (!url.port) {
      await checkTcpHostPort(ctx, url.hostname, 80, ipFamilyOpt);
    }
  } else {
    throw new Error(`Unknown protocol: ${url.protocol}`);
  }
}
async function checkTcpHostPort(ctx, host, port, ipFamilyOpt) {
  const ipFamily = ipFamilyNumbers[ipFamilyOpt];
  const tcpString = `TCP` + (ipFamilyOpt === "auto" ? "" : `/${ipFamilyOpt} ${host}:${port}`);
  try {
    const start = performance.now();
    const duration = await new Promise((resolve, reject) => {
      const socket = net.connect(
        {
          host,
          port,
          noDelay: true,
          family: ipFamily
        },
        () => resolve(performance.now() - start)
      );
      socket.on("error", (e) => reject(e));
    });
    logMessage(
      `${chalk.green(`\u2714`)} OK: ${tcpString} connect (${formatDuration(
        duration
      )})`
    );
  } catch (e) {
    let errorMessage = `${e}`;
    if (e instanceof AggregateError) {
      const individualErrors = e.errors.map((err, i) => `  ${i + 1}. ${err}`).join("\n");
      errorMessage = `AggregateError with ${e.errors.length} errors:
${individualErrors}`;
    }
    return ctx.crash({
      exitCode: 1,
      errorType: "transient",
      printedMessage: `FAIL: ${tcpString} connect (${errorMessage})`
    });
  }
}
async function checkHttp(ctx, urlString) {
  const url = new URL(urlString);
  const isHttps = url.protocol === "https:";
  if (isHttps) {
    url.protocol = "http:";
    url.port = "80";
    await checkHttpOnce(ctx, "HTTP", url.toString(), false);
  }
  await checkHttpOnce(ctx, isHttps ? "HTTPS" : "HTTP", urlString, true);
}
async function checkHttpOnce(ctx, name, url, allowRedirects) {
  const start = performance.now();
  try {
    const fetch = bareDeploymentFetch(ctx, { deploymentUrl: url });
    const instanceNameUrl = new URL("/instance_name", url);
    const resp = await fetch(instanceNameUrl.toString(), {
      redirect: allowRedirects ? "follow" : "manual"
    });
    if (resp.status !== 200) {
      throw new Error(`Unexpected status code: ${resp.status}`);
    }
  } catch (e) {
    const isOkayRedirect = !allowRedirects && e instanceof ThrowingFetchError && e.response.status === 301;
    if (!isOkayRedirect) {
      return ctx.crash({
        exitCode: 1,
        errorType: "transient",
        printedMessage: `FAIL: ${name} check (${e})`
      });
    }
  }
  const duration = performance.now() - start;
  logMessage(
    `${chalk.green(`\u2714`)} OK: ${name} check (${formatDuration(duration)})`
  );
}
async function checkWs(ctx, { url, adminKey }) {
  if (adminKey === null) {
    logWarning("Skipping WebSocket check because no admin key was provided.");
    return;
  }
  let queryPromiseResolver = null;
  const queryPromise = new Promise((resolve) => {
    queryPromiseResolver = resolve;
  });
  const logger = new DefaultLogger({
    verbose: process.env.CONVEX_VERBOSE !== void 0
  });
  logger.addLogLineListener((level, ...args) => {
    switch (level) {
      case "debug":
        logVerbose(...args);
        break;
      case "info":
        logVerbose(...args);
        break;
      case "warn":
        logWarning(...args);
        break;
      case "error":
        logWarning(...args);
        break;
    }
  });
  const convexClient = new BaseConvexClient(
    url,
    (updatedQueries) => {
      for (const queryToken of updatedQueries) {
        const result = convexClient.localQueryResultByToken(queryToken);
        if (typeof result === "string" && queryPromiseResolver !== null) {
          queryPromiseResolver(result);
          queryPromiseResolver = null;
        }
      }
    },
    {
      webSocketConstructor: ws,
      unsavedChangesWarning: false,
      logger
    }
  );
  convexClient.setAdminAuth(adminKey);
  convexClient.subscribe("_system/cli/convexUrl:cloudUrl", {});
  const racePromise = Promise.race([
    queryPromise,
    new Promise((resolve) => setTimeout(() => resolve(null), 1e4))
  ]);
  const cloudUrl = await racePromise;
  if (cloudUrl === null) {
    return ctx.crash({
      exitCode: 1,
      errorType: "transient",
      printedMessage: "FAIL: Failed to connect to deployment over WebSocket."
    });
  } else {
    logMessage(`${chalk.green(`\u2714`)} OK: WebSocket connection established.`);
  }
}
async function checkEcho(ctx, url, size) {
  try {
    const start = performance.now();
    const fetch = bareDeploymentFetch(ctx, {
      deploymentUrl: url,
      onError: (err) => {
        logFailure(
          chalk.red(`FAIL: echo ${formatSize(size)} (${err}), retrying...`)
        );
      }
    });
    const echoUrl = new URL(`/echo`, url);
    const data = crypto.randomBytes(size);
    const resp = await fetch(echoUrl.toString(), {
      body: data,
      method: "POST"
    });
    if (resp.status !== 200) {
      throw new Error(`Unexpected status code: ${resp.status}`);
    }
    const respData = await resp.arrayBuffer();
    if (!data.equals(Buffer.from(respData))) {
      throw new Error(`Response data mismatch`);
    }
    const duration = performance.now() - start;
    const bytesPerSecond = size / (duration / 1e3);
    logMessage(
      `${chalk.green(`\u2714`)} OK: echo ${formatSize(size)} (${formatDuration(
        duration
      )}, ${formatSize(bytesPerSecond)}/s)`
    );
  } catch (e) {
    return ctx.crash({
      exitCode: 1,
      errorType: "transient",
      printedMessage: `FAIL: echo ${formatSize(size)} (${e})`
    });
  }
}
export async function withTimeout(ctx, name, timeoutMs, f) {
  let timer = null;
  try {
    const result = await Promise.race([
      f.then((r) => {
        return { kind: "ok", result: r };
      }),
      new Promise((resolve) => {
        timer = setTimeout(() => {
          resolve({ kind: "timeout" });
          timer = null;
        }, timeoutMs);
      })
    ]);
    if (result.kind === "ok") {
      return result.result;
    } else {
      return await ctx.crash({
        exitCode: 1,
        errorType: "transient",
        printedMessage: `FAIL: ${name} timed out after ${formatDuration(timeoutMs)}.`
      });
    }
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }
}
//# sourceMappingURL=networkTest.js.map
