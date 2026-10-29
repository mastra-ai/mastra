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
        if host in {"127.0.0.1", "localhost", "::1"}:
            if port == 9222:
                raise PolicyError("control-cdp")
            if 40000 <= port <= 40031:
                raise PolicyError("control-bootstrap")
        if (scheme, host, port) not in self.origins or self.secret_in(host):
            raise PolicyError("origin")

    def request(self, request: http.Request, role: str) -> None:
        self.origin(request.scheme, request.host, request.port)
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
        expected_name = self.headers[role]
        if expected_name and not hmac.compare_digest(
            request.headers.get(expected_name, ""), self.secrets[role]
        ):
            raise PolicyError("identity")
        credential_names = {
            "authorization",
            "proxy-authorization",
            "cookie",
            "x-api-key",
            "x-test-identity",
        } | {name for name in self.headers.values() if name}
        for name in credential_names:
            if name != expected_name and name in request.headers:
                raise PolicyError("identity")
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

    def addresses(self, results: Sequence[tuple[int, int, int, str, Any]]) -> str:
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
        self.pending: dict[tuple[str, str, int], tuple[str, str]] = {}
        self.expected_peers: dict[str, str] = {}
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
        if self.deadline_handle:
            self.deadline_handle.cancel()

    def role(self, flow: http.HTTPFlow) -> str:
        if (
            not flow.client_conn.sockname
            or flow.client_conn.sockname[1] not in self.profiles
        ):
            raise PolicyError("profile")
        return self.profiles[flow.client_conn.sockname[1]]

    def release(self, flow: http.HTTPFlow) -> None:
        self.pending.pop(
            (flow.client_conn.id, flow.request.host, flow.request.port), None
        )
        self.reservations.pop(flow.id, None)
        if flow.metadata.pop("reserved", False):
            self.budget.release()
            self.counts["released-reservations"] += 1
        self.snapshot()

    def client_disconnected(self, client: connection.Client) -> None:
        # The disconnect hook precedes transport cancellation. An opening/live
        # upstream retains its slot until server_disconnected/connect_error.
        # Requests still awaiting DNS cannot open once their reservation is gone.
        for flow in tuple(self.reservations.values()):
            if flow.client_conn.id == client.id:
                self.counts["disconnected-reservations"] += 1
                self.pending.pop(
                    (client.id, flow.request.host, flow.request.port), None
                )
                if flow.server_conn.id not in self.expected_peers:
                    self.release(flow)

    def server_disconnected(self, data: ServerConnectionHookData) -> None:
        self.expected_peers.pop(data.server.id, None)
        self.release_server(data)

    def release_server(self, data: ServerConnectionHookData) -> None:
        for flow in tuple(self.reservations.values()):
            if flow.server_conn.id == data.server.id:
                self.release(flow)

    def deny(self, flow: http.HTTPFlow, reason: str) -> None:
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
        try:
            self.role(flow)
            self.policy.origin("https", flow.request.host, flow.request.port)
        except PolicyError as error:
            self.deny(flow, str(error))

    async def requestheaders(self, flow: http.HTTPFlow) -> None:
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
                not flow.server_conn.peername or flow.server_conn.peername[0] != address
            ):
                raise PolicyError("dns-peer-change")
            key = (flow.client_conn.id, flow.request.host, flow.request.port)
            self.pending[key] = (address, role)
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

    def server_connect(self, data: ServerConnectionHookData) -> None:
        if not data.server.address:
            data.server.error = "policy-no-address"
            return
        host, port = data.server.address
        authorization = self.pending.pop((data.client.id, host, port), None)
        if authorization is None:
            data.server.error = "policy-no-request-authorization"
            self.counts["denied-preconnect"] += 1
        else:
            address, _ = authorization
            data.server.sni = host
            data.server.address = (address, port)
            self.expected_peers[data.server.id] = address
            self.counts["numeric-pins"] += 1
        self.snapshot()

    def server_connected(self, data: ServerConnectionHookData) -> None:
        expected = self.expected_peers.get(data.server.id)
        if not data.server.peername or expected != data.server.peername[0]:
            data.server.error = "policy-peer-mismatch"
            self.counts["peer-mismatch"] += 1
            self.budget.exhausted = True
            self.budget.stream_stopped = True
            self.budget.exhaustion_reason = "peer-mismatch"
        else:
            self.counts["peer-verified"] += 1
        self.snapshot()

    def responseheaders(self, flow: http.HTTPFlow) -> None:
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
        identity_body = bytearray()

        def stream(chunk: bytes) -> bytes:
            if checking_identity:
                if len(identity_body) + len(chunk) <= 4096:
                    identity_body.extend(chunk)
                else:
                    flow.metadata["identity-overflow"] = True
            if not chunk and checking_identity:
                self.check_identity(flow, identity, bytes(identity_body))
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

    def check_identity(
        self, flow: http.HTTPFlow, identity: dict[str, str], body: bytes
    ) -> None:
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
        self.counts["tls-server-failed"] += 1
        self.snapshot()

    def server_connect_error(self, data: ServerConnectionHookData) -> None:
        self.counts["server-connect-errors"] += 1
        self.expected_peers.pop(data.server.id, None)
        self.release_server(data)
        self.snapshot()


addons = [Gateway()]
