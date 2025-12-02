/**
 * Parse Link HTTP header, eg `<https://huggingface.co/api/datasets/bigscience/P3/tree/main?recursive=1&cursor=...>; rel="next"`
 */
export function parseLinkHeader(header: string): Record<string, string> {
	const regex = /<(https?:[/][/][^>]+)>;\s+rel="([^"]+)"/g;

	return Object.fromEntries([...header.matchAll(regex)].map(([, url, rel]) => [rel, url]));
}
