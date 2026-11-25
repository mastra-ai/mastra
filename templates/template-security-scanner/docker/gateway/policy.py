from __future__ import annotations

import asyncio
import base64
import hmac
import ipaddress
import json
import posixpath
import re
import socket
import time
from collections import Counter
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Any, cast
from urllib.parse import unquote, urlsplit

from mitmproxy import connection, ctx, http
from mitmproxy.proxy.server_hooks import ServerConnectionHookData
from mitmproxy_rs.dns import DnsResolver


def credential_variants(secret: str) -> tuple[str, ...]:
    """Expand a secret into the bounded literal and encoded representations checked
    by the gateway.
    """
    raw = secret.encode()
    return (
        secret,
        base64.b64encode(raw).decode(),
        base64.urlsafe_b64encode(raw).decode().rstrip("="),
        raw.hex(),
        "".join(f"%{byte:02x}" for byte in raw),
        "".join(f"&#{ord(char)};" for char in secret),
        "".join(f"&#x{ord(char):x};" for char in secret),
    )


class PolicyError(Exception):
    pass


type Endpoint = tuple[str, int]


class Budget:
    def __init__(
        self, requests: int, response_bytes: int, concurrent: int, seconds: int
    ) -> None:
        self.remaining = requests
        self.bytes_left = response_bytes
        self.active = 0
        self.concurrent = concurrent
        self.deadline = time.monotonic() + seconds
        self.exhausted = False
        self.stream_stopped = False
        self.exhaustion_reason: str | None = None

    def reserve(self) -> None:
        """Reserve one request slot unless time, request, byte or concurrency limits
        prohibit admission.
        """
        reason = (
            "time"
            if time.monotonic() >= self.deadline
            else "requests"
            if self.remaining <= 0
            else "bytes"
            if self.bytes_left <= 0
            else self.exhaustion_reason
        )
        if reason:
            self.exhausted = True
            self.exhaustion_reason = reason
            self.stream_stopped = reason != "requests"
            raise PolicyError(f"budget-{reason}")
        if self.active >= self.concurrent:
            raise PolicyError("concurrency")
        self.remaining -= 1
        self.active += 1

    def consume(self, count: int) -> bool:
        """Charge streamed response bytes and stop output when the shared byte or
        time allowance is exhausted.
        """
        if (
            self.stream_stopped
            or time.monotonic() >= self.deadline
            or count > self.bytes_left
        ):
            self.exhausted = True
            self.stream_stopped = True
            self.exhaustion_reason = (
                "time" if time.monotonic() >= self.deadline else "bytes"
            )
            self.bytes_left = 0
            return False
        self.bytes_left -= count
        if self.bytes_left == 0:
            self.exhausted = True
            self.stream_stopped = True
            self.exhaustion_reason = "bytes"
        return True

    def release(self) -> None:
        self.active = max(0, self.active - 1)


class Policy:
    def __init__(
        self,
        config: dict[str, Any],
        secrets: dict[str, str],
        guards: list[tuple[str, str]] | None = None,
    ) -> None:
        """Build the request policy from configured origins, paths, credentials and
        optional guard values.
        """
        self.config = config
        self.secrets = secrets
        self.headers = config["headers"]
        self.variants = tuple(
            variant
            for secret in self.secret_values(
                [(self.headers[role], value) for role, value in secrets.items()]
                + (guards or [])
            )
            for variant in credential_variants(secret)
        )
        self.allowed_ips = frozenset(config.get("lab_ips", []))
        self.headers = config["headers"]
        self.origins = frozenset(tuple(origin) for origin in config["origins"])
        self.credential_origins = {
            role: tuple(origin) if origin is not None else None
            for role, origin in config["credential_origins"].items()
        }

    @staticmethod
    def secret_values(headers: Sequence[tuple[str | None, str]]) -> list[str]:
        """Extract nonempty secret values, including the credential portion of bearer
        authorization headers.
        """
        values = []
        for name, value in headers:
            if not value:
                continue
            values.append(value)
            if name == "authorization" and " " in value:
                values.append(value.split(" ", 1)[1])
            if name == "cookie":
                for cookie in value.split(";"):
                    if "=" in cookie and cookie.split("=", 1)[1].strip():
                        values.append(cookie.split("=", 1)[1].strip())
        return values

    def secret_in(self, value: str) -> bool:
        """Detect forbidden secret representations through the supported bounded
        decoding layers.
        """
        decoded = value
        for _ in range(3):
            if any(variant in decoded for variant in self.variants):
                return True
            decoded = re.sub(
                r"&#(?:x([a-fA-F0-9]+)|(\d+));",
                lambda match: chr(
                    min(0x10FFFF, int(match[1] or match[2], 16 if match[1] else 10))
                ),
                decoded,
            )
            decoded = unquote(decoded, errors="strict")
        if any(variant in decoded for variant in self.variants):
            return True
        if re.search(r"%[0-9a-fA-F]{2}", decoded):
            raise PolicyError("encoding-depth")
        return False

    def origin(self, scheme: str, host: str, port: int) -> None:
        """Reject unapproved origins and local browser-control or bootstrap
        endpoints.
        """
        if host in {"127.0.0.1", "localhost", "::1"}:
            if port == 9222:
                raise PolicyError("control-cdp")
            if 40000 <= port <= 40031:
                raise PolicyError("control-bootstrap")
        if (scheme, host, port) not in self.origins or self.secret_in(host):
            raise PolicyError("origin")

    def request(self, request: http.Request, role: str) -> None:
        """Validate origin, path, method, body and identity constraints before
        authorizing a request.
        """
        self.origin(request.scheme, request.host, request.port)
        if (
            self.config.get("inject_credentials")
            and self.secrets[role]
            and request.scheme != "https"
            and not self.allowed_ips
        ):
            raise PolicyError("credential-transport")
        if (
            self.secrets[role]
            and (request.scheme, request.host, request.port)
            != self.credential_origins[role]
        ):
            raise PolicyError("credential-origin")
        if request.method not in set(self.config["methods"]) & {"GET", "HEAD"}:
            raise PolicyError("method")
        if len(request.path) > 4096 or self.secret_in(request.path):
            raise PolicyError("credential-url")
        if (
            request.headers.get("content-length", "0") != "0"
            or "transfer-encoding" in request.headers
        ):
            raise PolicyError("body")
        if request.headers.get("upgrade") or "sec-websocket-key" in request.headers:
            raise PolicyError("upgrade")
        host_headers = request.headers.get_all("host")
        expected = (
            request.host
            if request.port == (443 if request.scheme == "https" else 80)
            else f"{request.host}:{request.port}"
        )
        if len(host_headers) != 1 or host_headers[0].lower() != expected:
            raise PolicyError("authority")
        if request.path.startswith("//"):
            raise PolicyError("path")
        parsed_path = urlsplit(request.path)
        if (
            parsed_path.scheme
            or parsed_path.netloc
            or parsed_path.fragment
            or "#" in request.path
        ):
            raise PolicyError("path")
        path = parsed_path.path
        for _ in range(2):
            path = unquote(path, errors="strict")
        if (
            not path.startswith("/")
            or path.startswith("//")
            or len(path) > 512
            or re.fullmatch(
                r"/(?:[a-zA-Z0-9_~-]+(?:\.[a-zA-Z0-9_~-]+)*(?:/[a-zA-Z0-9_~-]+(?:\.[a-zA-Z0-9_~-]+)*)*/?)?",
                path,
            )
            is None
            or "\\" in path
            or "\x00" in path
            or "%" in path
            or posixpath.normpath(path) != path.rstrip("/")
            and path != "/"
        ):
            raise PolicyError("path")

        def matches(prefix: str) -> bool:
            return (
                prefix == "/"
                or path == prefix
                or path.startswith(prefix.rstrip("/") + "/")
            )

        if not any(matches(prefix) for prefix in self.config["allowed_paths"]) or any(
            matches(prefix) for prefix in self.config["excluded_paths"]
        ):
            raise PolicyError("path")
        expected_name = self.headers[role]
        comparison = self.config.get("invalid_session_comparison")
        invalid_comparison = bool(
            comparison
            and self.allowed_ips
            and not expected_name
            and not self.secrets[role]
            and comparison["role"] == role
            and tuple(comparison["origin"])
            == (request.scheme, request.host, request.port)
            and comparison["path"] == request.path
            and request.headers.get("authorization") == "Bearer invalid-scanner-session"
        )
        credential_names = {
            "authorization",
            "proxy-authorization",
            "cookie",
            "x-api-key",
            "x-test-identity",
        } | {name for name in self.headers.values() if name}
        for name in credential_names:
            if invalid_comparison and name == "authorization":
                continue
            if name != expected_name and name in request.headers:
                raise PolicyError("identity")
        if expected_name:
            if self.config.get("inject_credentials"):
                if expected_name in request.headers:
                    raise PolicyError("identity")
            elif not hmac.compare_digest(
                request.headers.get(expected_name, ""), self.secrets[role]
            ):
                raise PolicyError("identity")

    def inject(self, request: http.Request, role: str) -> None:
        """Inject the configured role credential only when injection is enabled and
        the header is absent.
        """
        name = self.headers[role]
        if not self.config.get("inject_credentials") or not name:
            return
        if name in request.headers:
            raise PolicyError("identity")
        request.headers[name] = self.secrets[role]

    def addresses(self, results: Sequence[tuple[int, int, int, str, Any]]) -> str:
        """Validate every DNS answer against the address policy and select an allowed
        numeric endpoint.
        """
        addresses = {str(item[4][0]) for item in results}
        if not addresses:
            raise PolicyError("dns")
        for address in addresses:
            ip = ipaddress.ip_address(address)
            if (
                (
                    not self.allowed_ips
                    and (not ip.is_global or ip.is_multicast or ip.is_reserved)
                )
                or (self.allowed_ips and address not in self.allowed_ips)
                or (isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped)
            ):
                raise PolicyError("dns")
        return min(addresses)


class Gateway:
    def load(self, loader: Any) -> None:
        """Load private role headers and policy settings, then initialize gateway
        budgets and runtime tracking.
        """
        config = json.loads(Path("/workspace/policy.json").read_text())
        profiles = config["profiles"]
        secrets = {}
        self.profiles: dict[int, str] = {}
        for port, profile in profiles.items():
            private = Path(profile["header_file"])
            if private.stat().st_mode & 0o777 != 0o600:
                raise RuntimeError("private-profile-permissions")
            header = private.read_text().strip()
            name = config["headers"][profile["role"]]
            if name:
                if (
                    not header.lower().startswith(name + ": ")
                    or "\n" in header
                    or "\r" in header
                ):
                    raise RuntimeError("private-profile-format")
                secrets[profile["role"]] = header.split(": ", 1)[1]
            else:
                if header:
                    raise RuntimeError("private-profile-format")
                secrets[profile["role"]] = ""
            self.profiles[int(port)] = profile["role"]
        guards = []
        for path in config.get("guard_files", []):
            private = Path(path)
            if private.stat().st_mode & 0o777 != 0o600:
                raise RuntimeError("private-profile-permissions")
            header = private.read_text().strip()
            if ": " not in header or "\n" in header or "\r" in header:
                raise RuntimeError("private-profile-format")
            parts = header.split(": ", 1)
            guards.append((parts[0].lower(), parts[1]))
        self.policy = Policy(config, secrets, guards)
        self.budget = Budget(**config["budget"])
        self.counts: Counter[str] = Counter()
        self.pending: dict[tuple[str, str, int], tuple[Endpoint, str, str]] = {}
        self.expected_peers: dict[str, Endpoint] = {}
        self.verified_peers: set[str] = set()
        self.verified_flow_peers: dict[str, Endpoint] = {}
        self.connection_flows: dict[str, tuple[str, str, str, int, Endpoint, str]] = {}
        self.reservations: dict[str, http.HTTPFlow] = {}
        self.expired_roles: set[str] = set()
        self.deadline_handle: asyncio.TimerHandle | None = None
        self.shutdown_requested = False
        self.snapshot()

    def snapshot(self) -> None:
        result = {
            "counts": dict(self.counts),
            "remainingRequests": self.budget.remaining,
            "remainingBytes": self.budget.bytes_left,
            "active": self.budget.active,
            "exhausted": self.budget.exhausted,
            "exhaustionReason": self.budget.exhaustion_reason,
        }
        temporary = Path("/workspace/gateway-stats.tmp")
        temporary.write_text(json.dumps(result))
        temporary.replace("/workspace/gateway-stats.json")

    def running(self) -> None:
        self.deadline_handle = asyncio.get_running_loop().call_at(
            self.budget.deadline, self.time_expired
        )

    def time_expired(self) -> None:
        """Record shared deadline exhaustion and request gateway shutdown once."""
        if self.shutdown_requested:
            return
        self.shutdown_requested = True
        self.budget.exhausted = True
        self.budget.stream_stopped = True
        self.budget.exhaustion_reason = "time"
        self.counts["deadline-shutdown"] += 1
        self.snapshot()
        cast(Callable[[], None], ctx.master.shutdown)()

    def done(self) -> None:
        """Cancel the deadline timer when the gateway stops."""
        if self.deadline_handle:
            self.deadline_handle.cancel()

    def role(self, flow: http.HTTPFlow) -> str:
        """Resolve the isolated role from the client's configured gateway listener
        port.
        """
        if (
            not flow.client_conn.sockname
            or flow.client_conn.sockname[1] not in self.profiles
        ):
            raise PolicyError("profile")
        return self.profiles[flow.client_conn.sockname[1]]

    def release(self, flow: http.HTTPFlow) -> None:
        """Strip injected credentials and release the flow's active reservation
        without refunding consumed requests.
        """
        self.strip_credential(flow)
        self.pending.pop(
            (flow.client_conn.id, flow.request.host, flow.request.port), None
        )
        self.reservations.pop(flow.id, None)
        if flow.metadata.pop("reserved", False):
            self.budget.release()
            self.counts["released-reservations"] += 1
        self.snapshot()

    def strip_credential(self, flow: http.HTTPFlow) -> None:
        """Remove configured credential headers and clear the flow's injection
        marker.
        """
        if self.policy.config.get("inject_credentials"):
            for name in self.policy.headers.values():
                if name:
                    flow.request.headers.pop(name, None)
        flow.metadata.pop("credential-injected", None)

    def client_disconnected(self, client: connection.Client) -> None:
        # The disconnect hook precedes transport cancellation. An opening/live
        # upstream retains its slot until server_disconnected/connect_error.
        # Requests still awaiting DNS cannot open once their reservation is gone.
        """Reconcile client disconnection while retaining reservations needed by
        opening or live upstream connections.
        """
        for flow in tuple(self.reservations.values()):
            if flow.client_conn.id == client.id:
                self.counts["disconnected-reservations"] += 1
                self.strip_credential(flow)
                self.pending.pop(
                    (client.id, flow.request.host, flow.request.port), None
                )
                if flow.id not in {
                    binding[0] for binding in self.connection_flows.values()
                }:
                    self.release(flow)

    def server_disconnected(self, data: ServerConnectionHookData) -> None:
        self.expected_peers.pop(data.server.id, None)
        self.verified_peers.discard(data.server.id)
        self.release_server(data)

    def release_server(self, data: ServerConnectionHookData) -> None:
        self.release_connection(data.server.id)

    def release_connection(self, server_id: str) -> None:
        """Clear peer bindings and release reservations associated with a terminal
        upstream connection.
        """
        self.expected_peers.pop(server_id, None)
        self.verified_peers.discard(server_id)
        binding = self.connection_flows.pop(server_id, None)
        if binding:
            self.verified_flow_peers.pop(binding[5], None)
        for flow in tuple(self.reservations.values()):
            if flow.server_conn.id == server_id or (
                binding and (flow.id == binding[0] or flow.server_conn.id == binding[5])
            ):
                self.release(flow)

    def deny(self, flow: http.HTTPFlow, reason: str) -> None:
        """Return a trusted policy-denial response and record the bounded denial
        reason.
        """
        self.strip_credential(flow)
        self.pending.pop(
            (flow.client_conn.id, flow.request.host, flow.request.port), None
        )
        self.counts[f"denied-{reason}"] += 1
        flow.response = http.Response.make(
            401 if reason == "identity" else 403,
            b"policy-denied",
            {"Content-Type": "text/plain", "X-Scanner-Policy-Denied": "1"},
        )
        self.release(flow)

    def http_connect(self, flow: http.HTTPFlow) -> None:
        """Validate role and approved HTTPS origin before accepting a CONNECT tunnel."""
        try:
            self.role(flow)
            self.policy.origin("https", flow.request.host, flow.request.port)
        except PolicyError as error:
            self.deny(flow, str(error))

    async def requestheaders(self, flow: http.HTTPFlow) -> None:
        """Authorize request headers, reserve shared budget and prepare a validated
        upstream connection.
        """
        authorized = False
        try:
            role = self.role(flow)
            if role in self.expired_roles:
                raise PolicyError("identity")
            self.policy.request(flow.request, role)
            self.budget.reserve()
            flow.metadata["reserved"] = True
            self.reservations[flow.id] = flow
            self.counts[f"reserved-{role}"] += 1
            resolver_ip = self.policy.config.get("resolver_ip")
            if resolver_ip and resolver_ip not in self.policy.allowed_ips:
                raise PolicyError("resolver-config")
            resolver = DnsResolver(
                name_servers=[resolver_ip] if resolver_ip else None,
                use_hosts_file=False,
            )
            addresses = await asyncio.wait_for(resolver.lookup_ip(flow.request.host), 2)
            if len(addresses) > 32:
                raise PolicyError("dns-bound")
            results: Sequence[tuple[int, int, int, str, Any]] = [
                (
                    socket.AF_INET6 if ":" in address else socket.AF_INET,
                    socket.SOCK_STREAM,
                    0,
                    "",
                    (address, flow.request.port),
                )
                for address in addresses
            ]
            self.counts["fresh-dns-lookups"] += 1
            address = self.policy.addresses(results)
            endpoint = (address, flow.request.port)
            if (
                not flow.metadata.get("reserved")
                or flow.client_conn.timestamp_end is not None
            ):
                raise PolicyError("client-disconnected")
            if time.monotonic() >= self.budget.deadline:
                self.budget.exhausted = True
                self.budget.stream_stopped = True
                self.budget.exhaustion_reason = "time"
                raise PolicyError("budget-time")
            if flow.server_conn.connected and (
                self.verified_flow_peers.get(flow.server_conn.id) != endpoint
                or flow.server_conn.peername != endpoint
            ):
                raise PolicyError("dns-peer-change")
            key = (flow.client_conn.id, flow.request.host, flow.request.port)
            self.pending[key] = (endpoint, role, flow.id)
            flow.metadata["dns-endpoint"] = endpoint
            self.counts["authorized"] += 1
            self.snapshot()
            authorized = True
        except PolicyError as error:
            self.deny(flow, str(error))
        except (OSError, ValueError, TimeoutError):
            self.deny(flow, "dns")
        finally:
            if not authorized and flow.response is None:
                self.deny(flow, "resolver-failure")

    def request(self, flow: http.HTTPFlow) -> None:
        """Handle deferred role-credential injection after request authorization and
        connection preparation.
        """
        if (
            not self.policy.config.get("inject_credentials")
            or flow.response is not None
        ):
            return
        self.counts["credential-request-hook"] += 1
        try:
            role = self.role(flow)
            key = (flow.client_conn.id, flow.request.host, flow.request.port)
            pending = self.pending.get(key)
            endpoint = flow.metadata.get("dns-endpoint")
            if (
                not flow.metadata.get("reserved")
                or flow.client_conn.timestamp_end is not None
                or not endpoint
                or (
                    pending != (endpoint, role, flow.id)
                    and self.verified_flow_peers.get(flow.server_conn.id) != endpoint
                )
            ):
                raise PolicyError("pre-egress")
            flow.metadata["request-ready"] = True
            if (
                flow.server_conn.connected
                and self.verified_flow_peers.get(flow.server_conn.id) == endpoint
            ):
                self.inject_verified(flow, role)
            else:
                self.counts["credential-deferred"] += 1
        except PolicyError as error:
            self.deny(flow, str(error))

    def inject_verified(
        self, flow: http.HTTPFlow, role: str, server: connection.Server | None = None
    ) -> None:
        """Inject credentials only when the current reserved flow matches its
        verified numeric upstream peer.
        """
        endpoint = flow.metadata.get("dns-endpoint")
        peer = flow.server_conn.peername if server is None else server.peername
        binding = self.connection_flows.get(server.id) if server is not None else None
        verified = (
            (
                self.verified_flow_peers.get(flow.server_conn.id) == endpoint
                and flow.server_conn.connected
                if server is None
                else server.id in self.verified_peers
                and self.expected_peers.get(server.id) == endpoint
                and server.connected
                and server.address == endpoint
                and binding is not None
                and binding[0] == flow.id
                and binding[5] == flow.server_conn.id
            )
            and peer is not None
            and peer == endpoint
        )
        if (
            not flow.metadata.get("reserved")
            or not flow.metadata.get("request-ready")
            or flow.client_conn.timestamp_end is not None
            or not verified
        ):
            raise PolicyError("pre-egress")
        if flow.metadata.get("credential-injected"):
            return
        self.policy.inject(flow.request, role)
        flow.metadata["credential-injected"] = True
        self.counts["credential-injected"] += 1
        self.snapshot()

    def server_connect(self, data: ServerConnectionHookData) -> None:
        """Bind an authorized reserved flow to its expected numeric upstream endpoint
        before connecting.
        """
        if not data.server.address:
            data.server.error = "policy-no-address"
            return
        host, port = data.server.address
        authorization = self.pending.pop((data.client.id, host, port), None)
        flow = self.reservations.get(authorization[2]) if authorization else None
        if (
            authorization is None
            or flow is None
            or not flow.metadata.get("reserved")
            or (
                self.policy.config.get("inject_credentials")
                and not flow.metadata.get("request-ready")
            )
            or flow.client_conn.timestamp_end is not None
            or flow.client_conn.id != data.client.id
            or flow.request.host != host
            or flow.request.port != port
            or flow.metadata.get("dns-endpoint") != authorization[0]
            or authorization[0][1] != port
        ):
            data.server.error = "policy-no-request-authorization"
            self.counts["denied-preconnect"] += 1
        else:
            endpoint, _, _ = authorization
            data.server.sni = host
            data.server.address = endpoint
            self.expected_peers[data.server.id] = endpoint
            self.verified_peers.discard(data.server.id)
            self.connection_flows[data.server.id] = (
                flow.id,
                data.client.id,
                host,
                port,
                endpoint,
                flow.server_conn.id,
            )
            self.counts["numeric-pins"] += 1
        self.snapshot()

    def server_connected(self, data: ServerConnectionHookData) -> None:
        """Verify the connected peer against its reserved endpoint before marking the
        flow eligible for credentials.
        """
        expected = self.expected_peers.get(data.server.id)
        binding = self.connection_flows.get(data.server.id)
        flow = self.reservations.get(binding[0]) if binding else None
        if (
            not binding
            or not flow
            or not flow.metadata.get("reserved")
            or (
                self.policy.config.get("inject_credentials")
                and not flow.metadata.get("request-ready")
            )
            or flow.client_conn.timestamp_end is not None
            or data.client.id != binding[1]
            or flow.client_conn.id != binding[1]
            or flow.server_conn.id != binding[5]
            or flow.request.host != binding[2]
            or flow.request.port != binding[3]
            or flow.metadata.get("dns-endpoint") != binding[4]
            or binding[4][1] != binding[3]
            or data.server.address != binding[4]
            or data.server.peername is None
            or expected != data.server.peername
        ):
            data.server.error = "policy-peer-mismatch"
            self.counts["peer-mismatch"] += 1
            self.budget.exhausted = True
            self.budget.stream_stopped = True
            self.budget.exhaustion_reason = "peer-mismatch"
            self.verified_peers.discard(data.server.id)
            self.release_server(data)
        else:
            self.verified_peers.add(data.server.id)
            self.counts["peer-verified"] += 1
            self.verified_flow_peers[binding[5]] = expected
            if self.policy.config.get("inject_credentials"):
                try:
                    self.inject_verified(flow, self.role(flow), data.server)
                except PolicyError as error:
                    data.server.error = "policy-request-rejected"
                    self.deny(flow, str(error))
                    self.verified_peers.discard(data.server.id)
                    self.release_server(data)
        self.snapshot()

    def responseheaders(self, flow: http.HTTPFlow) -> None:
        """Attach trusted upstream provenance and install bounded response streaming
        and identity checks.
        """
        if flow.response is None or not flow.metadata.get("reserved"):
            return
        # Only the trusted local deny() path may produce this provenance marker.
        flow.response.headers.pop("X-Scanner-Policy-Denied", None)
        flow.response.headers["X-Scanner-Upstream-Observed"] = "1"
        if flow.response.status_code == 401 and self.policy.secrets[self.role(flow)]:
            role = self.role(flow)
            self.expired_roles.add(role)
            self.counts[f"auth-required-{role}"] += 1

        identity = self.policy.config.get("identities", {}).get(self.role(flow))
        checking_identity = bool(
            identity and flow.request.pretty_url == identity["endpoint"]
        )
        access_check = self.policy.config.get("access_checks", {}).get(self.role(flow))
        checking_access = bool(access_check and flow.request.pretty_url == access_check)
        identity_body = bytearray()

        def stream(chunk: bytes) -> bytes:
            """Bound identity-response buffering and charge streamed output against
            the shared response budget.
            """
            if checking_identity or checking_access:
                if len(identity_body) + len(chunk) <= 4096:
                    identity_body.extend(chunk)
                else:
                    flow.metadata["identity-overflow"] = True
            if not chunk and (checking_identity or checking_access):
                if checking_identity:
                    self.check_identity(flow, identity, bytes(identity_body))
                else:
                    self.check_access(flow, bytes(identity_body))
                identity_body.clear()

            if not chunk:
                return b""
            if not self.budget.consume(len(chunk)):
                if not self.shutdown_requested:
                    self.shutdown_requested = True
                    self.counts["response-budget-exhausted"] += 1
                    self.counts["byte-shutdown"] += 1
                    self.snapshot()
                    cast(Callable[[], None], ctx.master.shutdown)()
                return b""
            self.counts["response-bytes"] += len(chunk)
            return chunk

        flow.response.stream = stream

    def check_access(self, flow: http.HTTPFlow, body: bytes) -> None:
        """Classify the role's access-check response without treating an unavailable
        response as authenticated.
        """
        role = self.role(flow)
        status = "UNAVAILABLE"
        if flow.response is not None:
            if (
                flow.response.status_code in {401, 403}
                or 300 <= flow.response.status_code < 400
            ):
                status = "AUTH_REQUIRED"
            elif (
                flow.response.status_code == 200
                and not flow.metadata.get("identity-overflow")
                and flow.response.headers.get("content-type", "")
                .lower()
                .split(";", 1)[0]
                .strip()
                == "application/json"
            ):
                try:
                    observed = json.loads(body)
                    if isinstance(observed, (dict, list)):
                        status = "READY"
                except (ValueError, UnicodeError):
                    pass
        self.counts[f"identity-{role}-{status}"] += 1
        if status == "AUTH_REQUIRED":
            self.expired_roles.add(role)
        self.snapshot()

    def check_identity(
        self, flow: http.HTTPFlow, identity: dict[str, str], body: bytes
    ) -> None:
        """Compare a bounded identity response with the expected principal and record
        its access state.
        """
        role = self.role(flow)
        status = "UNAVAILABLE"
        if flow.response is not None:
            if (
                flow.response.status_code == 401
                or 300 <= flow.response.status_code < 400
            ):
                status = "AUTH_REQUIRED"
            elif flow.response.status_code == 200 and not flow.metadata.get(
                "identity-overflow"
            ):
                try:
                    observed = json.loads(body)
                    if isinstance(observed, dict) and set(observed) == {
                        "identity",
                        "role",
                    }:
                        status = (
                            "READY"
                            if observed["identity"] == identity["expected"]
                            and observed["role"] == role
                            else "AUTH_REQUIRED"
                        )
                except (ValueError, UnicodeError):
                    pass
        flow.metadata["identity-status"] = status
        self.counts[f"identity-{role}-{status}"] += 1
        if status == "AUTH_REQUIRED":
            self.expired_roles.add(role)
        self.snapshot()

    def response(self, flow: http.HTTPFlow) -> None:
        self.release(flow)

    def error(self, flow: http.HTTPFlow) -> None:
        self.counts["flow-errors"] += 1
        self.release(flow)

    def tls_failed_client(self, data: Any) -> None:
        self.counts["tls-client-failed"] += 1
        self.snapshot()

    def tls_failed_server(self, data: Any) -> None:
        """Record upstream TLS failure and release the associated verified peer and
        reservation state.
        """
        self.counts["tls-server-failed"] += 1
        server = getattr(data, "conn", None)
        if server is not None:
            self.expected_peers.pop(server.id, None)
            self.verified_peers.discard(server.id)
            self.release_connection(server.id)
        self.snapshot()

    def server_connect_error(self, data: ServerConnectionHookData) -> None:
        self.counts["server-connect-errors"] += 1
        self.expected_peers.pop(data.server.id, None)
        self.verified_peers.discard(data.server.id)
        self.release_server(data)
        self.snapshot()


addons = [Gateway()]
