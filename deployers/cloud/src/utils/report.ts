import { PROJECT_ID, BUILD_ID, BUILD_URL, USER_IP_ADDRESS } from './constants.js';

export function successEntrypoint() {
  return `
  if (process.env.CI !== 'true' && process.env.REPORTER_API_URL && process.env.REPORTER_API_URL_AUTH_TOKEN) {
    await fetch(process.env.REPORTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: \`Bearer \$\{process.env.REPORTER_API_URL_AUTH_TOKEN\}\`,
      },
      body: JSON.stringify(${JSON.stringify({
        projectId: PROJECT_ID,
        buildId: BUILD_ID,
        status: 'success',
        url: BUILD_URL,
        userIpAddress: USER_IP_ADDRESS,
      })}),
    }).catch(err => {
      console.error('Failed to report build status to monitoring service', {
        error: err,
      });
    })
  }
  `;
}
