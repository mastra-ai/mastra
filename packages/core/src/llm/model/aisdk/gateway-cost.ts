const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Only a Gateway customer response may turn its optional usage.cost into a customer charge. */
function isCustomerResponse(headers?: Record<string, string>) {
  return Object.entries(headers ?? {}).some(
    ([name, value]) => name.toLowerCase() === 'x-gateway-cost-source' && value === 'customer-v1',
  );
}

function customerCost(value: unknown): number | undefined {
  if (!isRecord(value)) return undefined;
  const body = isRecord(value.response) ? value.response : isRecord(value.message) ? value.message : value;
  if (!isRecord(body.usage)) return undefined;
  const raw = body.usage.cost;
  const cost = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : undefined;
  return cost !== undefined && Number.isFinite(cost) && cost >= 0 ? cost : undefined;
}

function withCost<T extends { providerMetadata?: Record<string, unknown> }>(value: T, cost: number | undefined) {
  if (cost === undefined) return value;
  return {
    ...value,
    providerMetadata: {
      ...value.providerMetadata,
      mastraGateway: {
        ...(isRecord(value.providerMetadata?.mastraGateway) ? value.providerMetadata.mastraGateway : {}),
        cost,
      },
    },
  };
}

/** Extract only the charge, without attaching the raw HTTP body to provider metadata or spans. */
export function withGatewayGenerateCost<
  T extends {
    providerMetadata?: Record<string, unknown>;
    response?: { headers?: Record<string, string>; body?: unknown };
  },
>(result: T): T {
  return isCustomerResponse(result.response?.headers) ? withCost(result, customerCost(result.response?.body)) : result;
}

/**
 * Native provider adapters validate away Gateway's extra usage fields. Their raw
 * frames retain the charge; consume those privately unless the caller requested them.
 */
export function withGatewayStreamCost<Part extends { type: string; providerMetadata?: Record<string, unknown> }>(
  result: { stream: ReadableStream<Part>; response?: { headers?: Record<string, string> } },
  includeRawChunks = false,
): ReadableStream<Part> {
  const customerResponse = isCustomerResponse(result.response?.headers);
  let cost: number | undefined;
  return result.stream.pipeThrough(
    new TransformStream<Part, Part>({
      transform(chunk, controller) {
        if (chunk.type === 'raw') {
          if (customerResponse && 'rawValue' in chunk) {
            const reported = customerCost(chunk.rawValue);
            if (reported !== undefined) cost = reported;
          }
          if (includeRawChunks) controller.enqueue(chunk);
          return;
        }
        controller.enqueue(chunk.type === 'finish' ? withCost(chunk, cost) : chunk);
      },
    }),
  );
}
