/**
 * The browser stream upgrade-ticket route is a raw adapter route and is not part
 * of the generated `@mastra/client-js` surface, so this fixture mirrors the
 * response shape the server returns instead of importing a client-js type.
 */
export interface BrowserStreamTicketResponse {
  ticket: string;
  expiresIn: number;
}

export const browserStreamTicketResponse: BrowserStreamTicketResponse = {
  ticket: '1f2e3d4c5b6a7988',
  expiresIn: 30,
};
