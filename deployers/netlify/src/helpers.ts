async function createNetlifySite({ token, name, scope }: { token: string; name: string; scope?: string }) {
  const response = await fetch('https://api.netlify.com/api/v1/sites', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: name,
      account_slug: scope, // Optional - if not provided, creates in user's default account
      force_ssl: true, // Enable HTTPS
    }),
  });

  const data = (await response.json()) as
    | {
        id: string;
        name: string;
        ssl_url: string;
        url: string;
        admin_url: string;
        message?: never;
      }
    | { message: string; id?: never; name?: never; ssl_url?: never; url?: never; admin_url?: never };

  if (!response.ok) {
    console.error(JSON.stringify(data));
    throw new Error(`Failed to create site: ${data.message || 'Unknown error'}`);
  }

  return {
    id: data.id,
    name: data.name,
    url: data.ssl_url || data.url,
    adminUrl: data.admin_url,
  };
}

async function findNetlifySite({ token, name, scope }: { token: string; name: string; scope: string }) {
  const response = await fetch(`https://api.netlify.com/api/v1/${scope}/sites?filter=all&name=${name}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = (await response.json()) as
    | {
        id: string;
        name: string;
        ssl_url: string;
        url: string;
        admin_url: string;
      }[]
    | { message: string };

  if (!response.ok || !Array.isArray(data)) {
    throw new Error(`Failed to search sites: ${(data as { message: string }).message || 'Unknown error'}`);
  }

  // Find exact match (filter can return partial matches)
  return data.find(site => site.name === name);
}

export async function getOrCreateSite({ token, name, scope }: { token: string; name: string; scope: string }) {
  let existingSite;
  try {
    existingSite = await findNetlifySite({ token, name, scope });
  } catch {}

  if (existingSite) {
    return existingSite;
  }

  return createNetlifySite({ token, name, scope });
}
