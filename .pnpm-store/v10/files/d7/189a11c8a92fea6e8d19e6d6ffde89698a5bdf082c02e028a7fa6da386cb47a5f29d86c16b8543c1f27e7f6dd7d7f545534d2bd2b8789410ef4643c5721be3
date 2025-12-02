//#region src/integrations/solid-start.d.ts
declare function toSolidStartHandler(auth: {
  handler: (request: Request) => Promise<Response>;
} | ((request: Request) => Promise<Response>)): {
  GET: (event: {
    request: Request;
  }) => Promise<Response>;
  POST: (event: {
    request: Request;
  }) => Promise<Response>;
  PATCH: (event: {
    request: Request;
  }) => Promise<Response>;
  PUT: (event: {
    request: Request;
  }) => Promise<Response>;
  DELETE: (event: {
    request: Request;
  }) => Promise<Response>;
};
//#endregion
export { toSolidStartHandler };