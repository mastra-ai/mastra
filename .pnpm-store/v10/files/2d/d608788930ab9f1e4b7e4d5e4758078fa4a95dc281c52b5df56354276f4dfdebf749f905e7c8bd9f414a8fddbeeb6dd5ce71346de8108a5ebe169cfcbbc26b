import * as Sentry from "@sentry/node";
import { version } from "../version.js";

const VERSION_ENDPOINT = "https://version.convex.dev/v1/version";
const CURSOR_RULES_ENDPOINT = "https://version.convex.dev/v1/cursor_rules";

const HEADERS = {
  "Convex-Client": `npm-cli-${version}`,
};

export type VersionResult = {
  message: string | null;
  cursorRulesHash: string | null;
};

export async function getVersion(): Promise<VersionResult | null> {
  try {
    const req = await fetch(VERSION_ENDPOINT, {
      headers: HEADERS,
    });

    if (!req.ok) {
      Sentry.captureException(
        new Error(`Failed to fetch version: status = ${req.status}`),
      );
      return null;
    }

    const json = await req.json();
    return validateVersionResult(json);
  } catch (error) {
    Sentry.captureException(error);
    return null;
  }
}

export function validateVersionResult(json: any): VersionResult | null {
  if (typeof json !== "object" || json === null) {
    Sentry.captureMessage("Invalid version result", "error");
    return null;
  }

  if (typeof json.message !== "string" && json.message !== null) {
    Sentry.captureMessage("Invalid version.message result", "error");
    return null;
  }

  if (
    typeof json.cursorRulesHash !== "string" &&
    json.cursorRulesHash !== null
  ) {
    Sentry.captureMessage("Invalid version.cursorRulesHash result", "error");
    return null;
  }

  return json;
}

export async function downloadLatestCursorRules(): Promise<string | null> {
  try {
    const req = await fetch(CURSOR_RULES_ENDPOINT, {
      headers: HEADERS,
    });

    if (!req.ok) {
      Sentry.captureMessage(
        `Failed to fetch Cursor rules: status = ${req.status}`,
      );
      return null;
    }

    const text = await req.text();
    return text;
  } catch (error) {
    Sentry.captureException(error);
    return null;
  }
}
