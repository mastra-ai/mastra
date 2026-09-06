export function getRequestBodies(requests: unknown[]): unknown[] {
  return requests.map(request =>
    typeof request === 'object' && request !== null && 'body' in request ? request.body : undefined,
  );
}
