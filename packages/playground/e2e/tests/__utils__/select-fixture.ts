import { Page, Route } from '@playwright/test';

export type Fixtures =
  | 'text-stream'
  | 'tool-stream'
  | 'workflow-stream'
  | 'om-observation-success'
  | 'om-observation-failed'
  | 'om-reflection'
  | 'om-shared-budget'
  | 'agent-builder-support'
  | 'agent-builder-standup'
  | 'agent-builder-pr-reviewer'
  | 'agent-builder-onboarding'
  | 'agent-builder-complex'
  | 'workflow-builder-lifecycle';

export const selectFixture = async (page: Page, fixture: Fixtures) => {
  const setFixture = (browserFixture: Fixtures) => {
    window.localStorage.setItem(
      'mastra-playground-store',
      `{"state":{"requestContext":{"fixture":"${browserFixture}"}},"version":0}`,
    );
  };

  await page.route(
    /(?:\/agents\/[^/]+\/(?:generate|stream|generate-legacy|stream-legacy|stream-until-idle|network|signals|send-message)|\/editor\/workflow-builder\/stream)(?:[/?#]|$)/,
    route => injectFixtureIntoAgentRequest(route, fixture),
  );
  await page.context().addInitScript(setFixture, fixture);
  await page.addInitScript(setFixture, fixture);
};

async function injectFixtureIntoAgentRequest(route: Route, fixture: Fixtures) {
  const request = route.request();
  const postData = request.postData();

  if (request.method() !== 'POST' || !postData) {
    await route.continue();
    return;
  }

  try {
    const body = JSON.parse(postData);
    addFixtureToAgentRequestBody(body, fixture);

    await route.continue({
      postData: JSON.stringify(body),
      headers: {
        ...request.headers(),
        'content-type': 'application/json',
      },
    });
  } catch {
    await route.continue();
  }
}

function addFixtureToAgentRequestBody(body: unknown, fixture: Fixtures) {
  if (!isRecord(body)) return;

  body.requestContext = withFixture(body.requestContext, fixture);

  if (isRecord(body.ifIdle) && isRecord(body.ifIdle.streamOptions)) {
    body.ifIdle.streamOptions.requestContext = withFixture(body.ifIdle.streamOptions.requestContext, fixture);
  }

  if (isRecord(body.streamOptions)) {
    body.streamOptions.requestContext = withFixture(body.streamOptions.requestContext, fixture);
  }
}

function withFixture(value: unknown, fixture: Fixtures) {
  return { ...(isRecord(value) ? value : {}), fixture };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
