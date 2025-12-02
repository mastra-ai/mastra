import "@sentry/tracing";
import { productionProvisionHost, provisionHost } from "../config.js";
import * as Sentry from "@sentry/node";
import { version } from "../../../index.js";
import { stripVTControlCharacters } from "util";

export const SENTRY_DSN =
  "https://f9fa0306e3d540079cf40ce8c2ad9644@o1192621.ingest.sentry.io/6390839";

export function initSentry() {
  if (
    (!process.env.CI || process.env.VERCEL === "1") &&
    provisionHost === productionProvisionHost
  ) {
    Sentry.init({
      dsn: SENTRY_DSN,
      release: "cli@" + version,
      tracesSampleRate: 0.2,
      beforeBreadcrumb: (breadcrumb) => {
        // Strip ANSI color codes from log lines that are sent as breadcrumbs.
        if (breadcrumb.message) {
          breadcrumb.message = stripVTControlCharacters(breadcrumb.message);
        }
        return breadcrumb;
      },
    });
  }
}
