import { mastra } from '@/mastra';

function stripHtml(html: string): string {
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, '');
  text = text.replace(/<header[\s\S]*?<\/header>/gi, '');
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|blockquote|section|article)>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '- ');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&#\d+;/g, '');
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n/g, '\n\n');
  return text.trim();
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (match) return match[1].trim();
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) return h1Match[1].replace(/<[^>]+>/g, '').trim();
  return 'Untitled Document';
}

/**
 * Detect congress.gov URLs and use their public API to fetch bill text directly.
 * The congress.gov website blocks server-side scraping, but their API and direct
 * bill text URLs are accessible.
 *
 * Supports URLs like:
 *   https://www.congress.gov/bill/119th-congress/senate-bill/2563/text/es
 *   https://www.congress.gov/bill/118th-congress/house-bill/1234/text
 */
async function fetchCongressGov(
  url: string,
  send: (event: string, data: unknown) => void,
): Promise<{ title: string; text: string } | null> {
  const congressMatch = url.match(
    /congress\.gov\/bill\/(\d+)\w*-congress\/(senate|house)-bill\/(\d+)/i,
  );
  if (!congressMatch) return null;

  const [, congress, chamber, billNumber] = congressMatch;
  const billType = chamber === 'senate' ? 's' : 'hr';

  send('status', { stage: 'fetching', message: 'Detected congress.gov — using Congress API...' });

  // Fetch bill metadata and text versions from the API
  const apiUrl = `https://api.congress.gov/v3/bill/${congress}/${billType}/${billNumber}/text?format=json&api_key=DEMO_KEY`;
  const apiRes = await fetch(apiUrl);
  if (!apiRes.ok) return null;

  const apiData = (await apiRes.json()) as {
    textVersions?: Array<{
      type?: string;
      formats?: Array<{ type?: string; url?: string }>;
    }>;
  };
  const versions = apiData.textVersions;
  if (!versions?.length) return null;

  // Use the version from the URL if specified, otherwise use the latest
  const versionSlug = url.match(/\/text\/([a-z]+)/i)?.[1]?.toLowerCase();
  let version = versions[0]; // default: latest
  if (versionSlug) {
    // Match slug to version type abbreviation (es=Engrossed in Senate, rs=Reported in Senate, etc.)
    const found = versions.find(v =>
      v.formats?.some(f => f.url?.toLowerCase().includes(versionSlug)),
    );
    if (found) version = found;
  }

  // Get the formatted text (HTML) URL
  const htmFormat = version.formats?.find(f => f.type === 'Formatted Text');
  const textUrl = htmFormat?.url;
  if (!textUrl) return null;

  // Fetch the actual bill text (these direct URLs are not blocked)
  const textRes = await fetch(textUrl);
  if (!textRes.ok) return null;

  const html = await textRes.text();
  const title = extractTitle(html) || `${congress}th Congress — ${chamber.charAt(0).toUpperCase() + chamber.slice(1)} Bill ${billNumber}`;
  const text = stripHtml(html);

  return { title, text };
}

async function fetchGenericUrl(url: string): Promise<{ title: string; text: string }> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const title = extractTitle(html);
  const text = stripHtml(html);

  return { title, text };
}

export async function POST(request: Request) {
  const { url, text: rawText, deliberate = false } = await request.json();

  if (!url && !rawText) {
    return Response.json({ error: 'A URL or text is required' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        let title: string;
        let text: string;

        if (rawText) {
          // Plain text input — extract title from first line or use default
          const lines = rawText.trim().split('\n');
          const firstLine = lines[0].replace(/^#+\s*/, '').trim();
          title = firstLine.length > 0 && firstLine.length <= 200 ? firstLine : 'Pasted Document';
          text = rawText.trim();

          send('status', {
            stage: 'fetched',
            message: `Document ready: "${title}" (${text.length} chars)`,
            title,
            charCount: text.length,
          });
        } else {
          send('status', { stage: 'fetching', message: 'Fetching document from URL...' });

          // Try congress.gov API first, fall back to generic fetch
          let doc = await fetchCongressGov(url, send);
          if (!doc) {
            doc = await fetchGenericUrl(url);
          }

          title = doc.title;
          text = doc.text;

          send('status', {
            stage: 'fetched',
            message: `Document fetched: "${title}" (${text.length} chars)`,
            title,
            charCount: text.length,
          });
        }

        if (text.length > 15000) {
          text = text.slice(0, 15000) + '\n\n[Document truncated for analysis]';
        }

        send('status', {
          stage: 'analyzing',
          message: deliberate
            ? 'Convening expert committees (with deliberation)...'
            : 'Convening expert committees...',
        });

        const workflowId = deliberate
          ? 'legislativeCouncilWithDeliberationWorkflow'
          : 'legislativeCouncilWorkflow';
        const workflow = mastra.getWorkflow(workflowId);
        const run = await workflow.createRun();
        const result = await run.start({ inputData: { title, text } });

        if (result.status === 'success') {
          send('result', {
            report: result.result.report,
            committees: result.result.committees,
            deliberations: result.result.deliberations ?? [],
            title,
          });
        } else {
          send('error', { message: 'Workflow failed. Check server logs for details.' });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        send('error', { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
