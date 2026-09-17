/**
 * BuildKit session that serves build secrets to the daemon.
 *
 * `docker build` with BuildKit (`version=2`) can attach a long-lived gRPC
 * "session" that the daemon calls back into for things it needs mid-build.
 * `RUN --mount=type=secret,id=X` is resolved by calling
 * `/moby.buildkit.secrets.v1.Secrets/GetSecret` on that session, so the value
 * exists only in the tmpfs mount for the duration of that one RUN — never as a
 * build arg, layer, history entry, or cache metadata.
 *
 * dockerode's own session helper only registers the registry-auth service and
 * overwrites any `session` id passed to `buildImage`, so this module dials the
 * hijacked `/session` endpoint itself and registers both services.
 */
import { randomUUID } from 'node:crypto';
import { Server, ServerCredentials, type ServiceDefinition, type UntypedServiceImplementation } from '@grpc/grpc-js';
import type Docker from 'dockerode';

export const SECRETS_GET_METHOD = '/moby.buildkit.secrets.v1.Secrets/GetSecret';
const AUTH_CREDENTIALS_METHOD = '/moby.filesync.v1.Auth/Credentials';

export interface BuildSession {
  id: string;
  close(): void;
}

/**
 * Open a session that answers `GetSecret` from `secrets`. The returned id must
 * be sent as the `session` query parameter of the build request.
 */
export function openBuildSession(docker: Docker, secrets: Record<string, string>): Promise<BuildSession> {
  const id = randomUUID();
  return new Promise((resolve, reject) => {
    docker.modem.dial(
      {
        method: 'POST',
        path: '/session',
        hijack: true,
        headers: {
          Upgrade: 'h2c',
          'X-Docker-Expose-Session-Uuid': id,
          'X-Docker-Expose-Session-Name': 'mastra-docker-template',
          // The daemon only calls methods the client advertises.
          'X-Docker-Expose-Session-Grpc-Method': [SECRETS_GET_METHOD, AUTH_CREDENTIALS_METHOD],
        },
        statusCodes: { 200: true, 500: 'server error' },
      },
      (err: Error | null, socket: unknown) => {
        if (err) {
          reject(err);
          return;
        }
        const server = new Server();
        server.createConnectionInjector(ServerCredentials.createInsecure()).injectConnection(socket as never);
        server.addService(secretsService, {
          GetSecret(
            call: { request: GetSecretRequest },
            callback: (err: Error | null, res?: GetSecretResponse) => void,
          ) {
            const value = Object.hasOwn(secrets, call.request.id) ? secrets[call.request.id] : undefined;
            if (value === undefined) {
              callback(
                Object.assign(new Error(`no build secret registered with id '${call.request.id}'`), { code: 5 }),
              );
              return;
            }
            callback(null, { data: Buffer.from(value, 'utf8') });
          },
        } as UntypedServiceImplementation);
        server.addService(authService, {
          Credentials(_call: unknown, callback: (err: Error | null, res?: Record<string, never>) => void) {
            callback(null, {});
          },
        } as UntypedServiceImplementation);
        resolve({
          id,
          close() {
            server.forceShutdown();
            (socket as { end(): void }).end();
          },
        });
      },
    );
  });
}

// ---------------------------------------------------------------------------
// Wire format
//
// The two messages involved are small enough that hand-rolling the protobuf
// encoding beats loading .proto files at runtime (which would not survive
// bundling).
//
//   message GetSecretRequest  { string ID = 1; map<string,string> annotations = 2; }
//   message GetSecretResponse { bytes data = 1; }
//   message CredentialsResponse { string Username = 1; string Secret = 2; }
// ---------------------------------------------------------------------------

export interface GetSecretRequest {
  id: string;
}
export interface GetSecretResponse {
  data: Buffer;
}

/** @internal exported for tests */
export function decodeGetSecretRequest(buffer: Buffer): GetSecretRequest {
  let offset = 0;
  let id = '';
  const readVarint = (): number => {
    let result = 0;
    let shift = 0;
    for (;;) {
      if (offset >= buffer.length) throw new Error('truncated varint');
      const byte = buffer[offset++]!;
      result += (byte & 0x7f) * 2 ** shift;
      if ((byte & 0x80) === 0) return result;
      shift += 7;
    }
  };
  while (offset < buffer.length) {
    const key = readVarint();
    const field = Math.floor(key / 8);
    const wireType = key % 8;
    switch (wireType) {
      case 0:
        readVarint();
        break;
      case 1:
        offset += 8;
        break;
      case 5:
        offset += 4;
        break;
      case 2: {
        const length = readVarint();
        const value = buffer.subarray(offset, offset + length);
        offset += length;
        if (field === 1) id = value.toString('utf8');
        break;
      }
      default:
        throw new Error(`unsupported protobuf wire type ${wireType}`);
    }
  }
  return { id };
}

/** @internal exported for tests */
export function encodeGetSecretResponse(response: GetSecretResponse): Buffer {
  return Buffer.concat([Buffer.from([0x0a]), encodeVarint(response.data.length), response.data]);
}

function encodeVarint(value: number): Buffer {
  const bytes: number[] = [];
  let remaining = value;
  while (remaining >= 0x80) {
    bytes.push((remaining % 0x80) | 0x80);
    remaining = Math.floor(remaining / 0x80);
  }
  bytes.push(remaining);
  return Buffer.from(bytes);
}

const secretsService: ServiceDefinition = {
  GetSecret: {
    path: SECRETS_GET_METHOD,
    requestStream: false,
    responseStream: false,
    requestSerialize: () => {
      throw new Error('server does not serialize requests');
    },
    requestDeserialize: decodeGetSecretRequest,
    responseSerialize: encodeGetSecretResponse,
    responseDeserialize: () => {
      throw new Error('server does not deserialize responses');
    },
  },
};

const authService: ServiceDefinition = {
  Credentials: {
    path: AUTH_CREDENTIALS_METHOD,
    requestStream: false,
    responseStream: false,
    requestSerialize: () => {
      throw new Error('server does not serialize requests');
    },
    requestDeserialize: () => ({}),
    // Empty message: anonymous registry access.
    responseSerialize: () => Buffer.alloc(0),
    responseDeserialize: () => {
      throw new Error('server does not deserialize responses');
    },
  },
};
