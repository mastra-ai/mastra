import { z } from 'zod';

/**
 * The app-only tool apps read Mastra data through. Apps run in a sandboxed iframe that hosts may
 * forbid from reaching the server, so each request `MastraClient` makes travels as a call to this
 * tool over the host's existing MCP connection instead. The server registering the app answers it:
 * it decides which routes apps may reach and runs them.
 */
export const REQUEST_TOOL_NAME = 'mastraRequest';

/** A request as `MastraClient` makes it, without the server's API prefix. */
export const requestToolInputSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string().startsWith('/'),
  /** The query string, one entry per key; repeated keys become arrays. */
  query: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
  body: z.unknown().optional(),
});

export type RequestToolInput = z.output<typeof requestToolInputSchema>;

/** What the tool answers: the route's own status and body, as it would over HTTP. */
export const requestToolOutputSchema = z.object({
  status: z.number().int(),
  body: z.unknown(),
});

export type RequestToolOutput = z.output<typeof requestToolOutputSchema>;
