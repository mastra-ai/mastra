import { Context } from "../../bundler/context.js";
import {
  logFailure,
  logFinishedStep,
  logMessage,
  logVerbose,
  logWarning,
} from "../../bundler/log.js";
import chalk from "chalk";
import * as net from "net";
import * as dns from "dns";
import * as crypto from "crypto";
import {
  bareDeploymentFetch,
  formatDuration,
  formatSize,
  ThrowingFetchError,
} from "./utils/utils.js";
import ws from "ws";
import { BaseConvexClient } from "../../browser/index.js";
import { DefaultLogger } from "../../browser/logging.js";
const ipFamilyNumbers = { ipv4: 4, ipv6: 6, auto: 0 } as const;
const ipFamilyNames = { 4: "ipv4", 6: "ipv6", 0: "auto" } as const;

export async function runNetworkTestOnUrl(
  ctx: Context,
  { url, adminKey }: { url: string; adminKey: string | null },
  options: {
    ipFamily?: string;
    speedTest?: boolean;
  },
) {
  // First, check DNS to see if we can resolve the URL's hostname.
  await checkDns(ctx, url);

  // Second, check to see if we can open a TCP connection to the hostname.
  await checkTcp(ctx, url, options.ipFamily ?? "auto");

  // Third, do a simple HTTPS request and check that we receive a 200.
  await checkHttp(ctx, url);

  // Fourth, check that we can open a WebSocket connection to the hostname.
  await checkWs(ctx, { url, adminKey });

  // Fifth, check a small echo request, much smaller than most networks' MTU.
  await checkEcho(ctx, url, 128);

  // Finally, try a large echo request, much larger than most networks' MTU.
  await checkEcho(ctx, url, 4 * 1024 * 1024);
  // Also do a 64MiB echo test if the user has requested a speed test.
  if (options.speedTest) {
    await checkEcho(ctx, url, 64 * 1024 * 1024);
  }

  logFinishedStep("Network test passed.");
}

async function checkDns(ctx: Context, url: string) {
  try {
    const hostname = new URL("/", url).hostname;
    const start = performance.now();
    type DnsResult = { duration: number; address: string; family: number };
    const result = await new Promise<DnsResult>((resolve, reject) => {
      dns.lookup(hostname, (err, address, family) => {
        if (err) {
          reject(err);
        } else {
          resolve({ duration: performance.now() - start, address, family });
        }
      });
    });
    logMessage(
      `${chalk.green(`✔`)} OK: DNS lookup => ${result.address}:${
        ipFamilyNames[result.family as keyof typeof ipFamilyNames]
      } (${formatDuration(result.duration)})`,
    );
  } catch (e: any) {
    return ctx.crash({
      exitCode: 1,
      errorType: "transient",
      printedMessage: `FAIL: DNS lookup (${e})`,
    });
  }
}

async function checkTcp(ctx: Context, urlString: string, ipFamilyOpt: string) {
  const url = new URL(urlString);
  if (url.protocol === "http:") {
    const port = Number.parseInt(url.port || "80");
    await checkTcpHostPort(ctx, url.hostname, port, ipFamilyOpt);
  } else if (url.protocol === "https:") {
    const port = Number.parseInt(url.port || "443");
    await checkTcpHostPort(ctx, url.hostname, port, ipFamilyOpt);
    // If we didn't specify a port, also try port 80.
    if (!url.port) {
      await checkTcpHostPort(ctx, url.hostname, 80, ipFamilyOpt);
    }
  } else {
    // eslint-disable-next-line no-restricted-syntax
    throw new Error(`Unknown protocol: ${url.protocol}`);
  }
}

async function checkTcpHostPort(
  ctx: Context,
  host: string,
  port: number,
  ipFamilyOpt: string,
) {
  const ipFamily = ipFamilyNumbers[ipFamilyOpt as keyof typeof ipFamilyNumbers];
  const tcpString =
    `TCP` + (ipFamilyOpt === "auto" ? "" : `/${ipFamilyOpt} ${host}:${port}`);
  try {
    const start = performance.now();
    const duration = await new Promise<number>((resolve, reject) => {
      const socket = net.connect(
        {
          host,
          port,
          noDelay: true,
          family: ipFamily,
        },
        () => resolve(performance.now() - start),
      );
      socket.on("error", (e) => reject(e));
    });
    logMessage(
      `${chalk.green(`✔`)} OK: ${tcpString} connect (${formatDuration(
        duration,
      )})`,
    );
  } catch (e: any) {
    let errorMessage = `${e}`;
    if (e instanceof AggregateError) {
      const individualErrors = e.errors
        .map((err, i) => `  ${i + 1}. ${err}`)
        .join("\n");
      errorMessage = `AggregateError with ${e.errors.length} errors:\n${individualErrors}`;
    }
    return ctx.crash({
      exitCode: 1,
      errorType: "transient",
      printedMessage: `FAIL: ${tcpString} connect (${errorMessage})`,
    });
  }
}

async function checkHttp(ctx: Context, urlString: string) {
  const url = new URL(urlString);
  const isHttps = url.protocol === "https:";
  if (isHttps) {
    url.protocol = "http:";
    url.port = "80";
    await checkHttpOnce(ctx, "HTTP", url.toString(), false);
  }
  await checkHttpOnce(ctx, isHttps ? "HTTPS" : "HTTP", urlString, true);
}

// Be sure to test this function against *prod* (with both HTTP & HTTPS) when
// making changes.
async function checkHttpOnce(
  ctx: Context,
  name: string,
  url: string,
  allowRedirects: boolean,
) {
  const start = performance.now();
  try {
    // Be sure to use the same `deploymentFetch` we use elsewhere so we're actually
    // getting coverage of our network stack.
    const fetch = bareDeploymentFetch(ctx, { deploymentUrl: url });
    const instanceNameUrl = new URL("/instance_name", url);
    const resp = await fetch(instanceNameUrl.toString(), {
      redirect: allowRedirects ? "follow" : "manual",
    });
    if (resp.status !== 200) {
      // eslint-disable-next-line no-restricted-syntax
      throw new Error(`Unexpected status code: ${resp.status}`);
    }
  } catch (e: any) {
    // Redirects return a 301, which causes `bareDeploymentFetch` to throw an
    // ThrowingFetchError. Catch that here and succeed if we're not following
    // redirects.
    const isOkayRedirect =
      !allowRedirects &&
      e instanceof ThrowingFetchError &&
      e.response.status === 301;
    if (!isOkayRedirect) {
      return ctx.crash({
        exitCode: 1,
        errorType: "transient",
        printedMessage: `FAIL: ${name} check (${e})`,
      });
    }
  }
  const duration = performance.now() - start;
  logMessage(
    `${chalk.green(`✔`)} OK: ${name} check (${formatDuration(duration)})`,
  );
}

async function checkWs(
  ctx: Context,
  { url, adminKey }: { url: string; adminKey: string | null },
) {
  if (adminKey === null) {
    logWarning("Skipping WebSocket check because no admin key was provided.");
    return;
  }
  let queryPromiseResolver: ((value: string) => void) | null = null;
  const queryPromise = new Promise<string | null>((resolve) => {
    queryPromiseResolver = resolve;
  });
  const logger = new DefaultLogger({
    verbose: process.env.CONVEX_VERBOSE !== undefined,
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
        // TODO: logFailure is a little hard to use here because it also interacts
        // with the spinner and requires a string.
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
      webSocketConstructor: ws as unknown as typeof WebSocket,
      unsavedChangesWarning: false,
      logger,
    },
  );
  convexClient.setAdminAuth(adminKey);
  convexClient.subscribe("_system/cli/convexUrl:cloudUrl", {});
  const racePromise = Promise.race([
    queryPromise,
    new Promise((resolve) => setTimeout(() => resolve(null), 10000)),
  ]);
  const cloudUrl = await racePromise;
  if (cloudUrl === null) {
    return ctx.crash({
      exitCode: 1,
      errorType: "transient",
      printedMessage: "FAIL: Failed to connect to deployment over WebSocket.",
    });
  } else {
    logMessage(`${chalk.green(`✔`)} OK: WebSocket connection established.`);
  }
}

async function checkEcho(ctx: Context, url: string, size: number) {
  try {
    const start = performance.now();
    const fetch = bareDeploymentFetch(ctx, {
      deploymentUrl: url,
      onError: (err) => {
        logFailure(
          chalk.red(`FAIL: echo ${formatSize(size)} (${err}), retrying...`),
        );
      },
    });
    const echoUrl = new URL(`/echo`, url);
    const data = crypto.randomBytes(size);
    const resp = await fetch(echoUrl.toString(), {
      body: data,
      method: "POST",
    });
    if (resp.status !== 200) {
      // eslint-disable-next-line no-restricted-syntax
      throw new Error(`Unexpected status code: ${resp.status}`);
    }
    const respData = await resp.arrayBuffer();
    if (!data.equals(Buffer.from(respData))) {
      // eslint-disable-next-line no-restricted-syntax
      throw new Error(`Response data mismatch`);
    }
    const duration = performance.now() - start;
    const bytesPerSecond = size / (duration / 1000);
    logMessage(
      `${chalk.green(`✔`)} OK: echo ${formatSize(size)} (${formatDuration(
        duration,
      )}, ${formatSize(bytesPerSecond)}/s)`,
    );
  } catch (e: any) {
    return ctx.crash({
      exitCode: 1,
      errorType: "transient",
      printedMessage: `FAIL: echo ${formatSize(size)} (${e})`,
    });
  }
}

export async function withTimeout<T>(
  ctx: Context,
  name: string,
  timeoutMs: number,
  f: Promise<T>,
) {
  let timer: NodeJS.Timeout | null = null;
  try {
    type TimeoutPromise = { kind: "ok"; result: T } | { kind: "timeout" };
    const result = await Promise.race<TimeoutPromise>([
      f.then((r) => {
        return { kind: "ok", result: r };
      }),
      new Promise((resolve) => {
        timer = setTimeout(() => {
          resolve({ kind: "timeout" as const });
          timer = null;
        }, timeoutMs);
      }),
    ]);
    if (result.kind === "ok") {
      return result.result;
    } else {
      return await ctx.crash({
        exitCode: 1,
        errorType: "transient",
        printedMessage: `FAIL: ${name} timed out after ${formatDuration(timeoutMs)}.`,
      });
    }
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }
}
