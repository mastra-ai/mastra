import asyncio
import secrets
import socket
import unittest
from collections import Counter
from types import SimpleNamespace
from typing import cast
from unittest.mock import patch
from urllib.parse import urlsplit

from mitmproxy import connection, http
from mitmproxy.proxy.server_hooks import ServerConnectionHookData

from policy import Budget, Gateway, Policy, PolicyError, credential_variants


class GatewayPolicyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.token = secrets.token_hex(24) + "=="
        self.config = {
            "origins": [["http", "allowed.lab", 18080], ["http", "second.lab", 18080]],
            "headers": {"reader": "x-api-key", "public": None},
            "credential_origins": {
                "reader": ["http", "allowed.lab", 18080],
                "public": None,
            },
            "methods": ["GET", "HEAD"],
            "allowed_paths": ["/"],
            "excluded_paths": ["/excluded"],
        }
        self.policy = Policy(self.config, {"reader": self.token, "public": ""})

    def request(self, path: str = "/catalog?category=books") -> http.Request:
        # URL construction may normalize or reject malformed paths before the
        # policy sees them. Assign the actual parsed HTTP request-target field.
        request = http.Request.make(
            "GET",
            "http://allowed.lab:18080/",
            headers=http.Headers(
                [(b"host", b"allowed.lab:18080"), (b"x-api-key", self.token.encode())]
            ),
        )
        request.path = path
        return request

    def test_failed_peer_connection_releases_expected_peer_pin(self) -> None:
        # C-008: a mismatched upstream peer must not leave a stale expected pin.
        gateway = Gateway()
        gateway.expected_peers = {"server-1": ("192.0.2.10", 18080)}
        gateway.verified_peers = {"server-1"}
        gateway.connection_flows = {}
        gateway.verified_flow_peers = {}
        gateway.reservations = {}
        gateway.release_connection("server-1")
        self.assertEqual(gateway.expected_peers, {})
        self.assertEqual(gateway.verified_peers, set())

    def test_rest_gateway_rejects_presupplied_key_even_when_value_matches(self) -> None:
        # D-001: only the gateway may add the key after the verified peer check.
        policy = Policy(
            {**self.config, "inject_credentials": True, "lab_ips": ["192.0.2.10"]},
            {"reader": self.token, "public": ""},
        )
        with self.assertRaisesRegex(PolicyError, "identity"):
            policy.request(self.request(), "reader")
        request = self.request()
        request.headers.pop("x-api-key", None)
        policy.request(request, "reader")
        self.assertNotIn("x-api-key", request.headers)

    def test_network_path_authority_is_never_discarded_before_policy(self) -> None:
        # Preserve the original lossy-predicate counterexample. No wire request
        # runs the old predicate; production Policy must reject all these forms.
        """Verify network-path authorities remain visible to policy checks instead of
        being discarded during normalization.
        """
        self.assertEqual(urlsplit("//excluded/nope").path, "/nope")
        self.assertEqual(urlsplit("///catalog").path, "/catalog")
        for path in (
            "//excluded/nope",
            "///excluded/nope",
            "/%2fexcluded/nope",
            "/%252fexcluded/nope",
            "/excluded;param/nope",
            "/excluded%3bparam/nope",
            "/excluded%253bparam/nope",
            "/a//b",
            "/a/../catalog",
            "/café",
        ):
            with self.subTest(path=path), self.assertRaises(PolicyError):
                self.policy.request(self.request(path), "reader")
        for path in ("/catalog", "/catalog.json", "/catalog?category=books"):
            self.policy.request(self.request(path), "reader")

    def test_padded_header_values_do_not_become_cookie_fragments(self) -> None:
        self.policy.request(self.request(), "reader")
        self.assertFalse(self.policy.secret_in("/catalog?category=books"))
        self.assertTrue(self.policy.secret_in("/reflected?value=" + self.token))
        auth = Policy(
            {**self.config, "headers": {"reader": "authorization"}},
            {"reader": "Bearer " + self.token},
        )
        self.assertFalse(auth.secret_in("/catalog?category=books"))
        self.assertTrue(auth.secret_in("/reflected?value=" + self.token))

    def test_invalid_session_comparison_is_exact_owned_public_scope(self) -> None:
        """Verify invalid-session comparisons remain confined to the exact owned
        public resource scope.
        """
        comparison: dict[str, object] = {
            "role": "public",
            "origin": ["http", "allowed.lab", 18080],
            "path": "/owned/auth/vulnerable",
        }
        config: dict[str, object] = {
            **self.config,
            "lab_ips": ["192.0.2.10"],
            "invalid_session_comparison": comparison,
        }
        policy = Policy(config, {"reader": self.token, "public": ""})
        request = http.Request.make(
            "GET",
            "http://allowed.lab:18080/owned/auth/vulnerable",
            headers=http.Headers(
                [
                    (b"host", b"allowed.lab:18080"),
                    (b"authorization", b"Bearer invalid-scanner-session"),
                ]
            ),
        )
        policy.request(request, "public")
        for changed in (
            {**config, "lab_ips": []},
            {**config, "invalid_session_comparison": None},
            {
                **config,
                "invalid_session_comparison": {
                    **comparison,
                    "path": "/owned/auth/patched",
                },
            },
            {
                **config,
                "invalid_session_comparison": {
                    **comparison,
                    "origin": ["http", "second.lab", 18080],
                },
            },
            {**config, "invalid_session_comparison": {**comparison, "role": "reader"}},
        ):
            with self.subTest(config=changed), self.assertRaises(PolicyError):
                Policy(changed, {"reader": self.token, "public": ""}).request(
                    request, "public"
                )
        with self.assertRaises(PolicyError):
            policy.request(request, "reader")
        for path in ("/owned/auth/patched", "/owned/auth/vulnerable?next=1"):
            changed_request = request.copy()
            changed_request.path = path
            with self.assertRaises(PolicyError):
                policy.request(changed_request, "public")
        for name, value in (
            ("authorization", "Bearer another-session"),
            ("cookie", "session=invalid"),
            ("x-api-key", "invalid"),
        ):
            changed_request = request.copy()
            changed_request.headers[name] = value
            with self.assertRaises(PolicyError):
                policy.request(changed_request, "public")

    def test_cookie_and_unselected_role_credentials_remain_forbidden(self) -> None:
        cookie = Policy(
            {**self.config, "headers": {"reader": "cookie"}},
            {"reader": "session=" + self.token},
        )
        self.assertTrue(cookie.secret_in("/reflected?value=" + self.token))
        public = Policy(
            self.config,
            {"reader": self.token, "public": ""},
            [("authorization", "Bearer " + self.token)],
        )
        self.assertTrue(public.secret_in("/reflected?value=" + self.token))
        conservative = Policy(
            {**self.config, "headers": {"reader": "cookie"}},
            {"reader": "session=" + self.token + "; locale=en"},
        )
        self.assertTrue(conservative.secret_in("/endpoint"))

    def test_all_supported_url_encodings_and_excess_depth_fail_closed(self) -> None:
        """Verify supported credential encodings and excess decoding depth are
        rejected conservatively.
        """
        for encoded in credential_variants(self.token):
            self.assertTrue(self.policy.secret_in("/reflected?value=" + encoded))
        value = "".join(f"%{byte:02x}" for byte in self.token.encode())
        for _ in range(5):
            with self.assertRaises(PolicyError):
                self.policy.request(self.request("/reflected?value=" + value), "reader")
            value = value.replace("%", "%25")

    def test_origin_binding_host_body_upgrade_and_methods_are_authorized(self) -> None:
        """Verify origin, host, method, body and protocol-upgrade constraints are
        enforced on requests.
        """
        other = http.Request.make(
            "GET",
            "http://second.lab:18080/catalog",
            headers=http.Headers(
                [(b"host", b"second.lab:18080"), (b"x-api-key", self.token.encode())]
            ),
        )
        with self.assertRaises(PolicyError):
            self.policy.request(other, "reader")
        for change in ("method", "host", "body", "upgrade"):
            request = self.request()
            if change == "method":
                request.method = "POST"
            elif change == "host":
                request.headers["Host"] = "denied.lab:18081"
            elif change == "body":
                request.headers["Content-Length"] = "1"
            else:
                request.headers["Upgrade"] = "websocket"
            with self.assertRaises(PolicyError):
                self.policy.request(request, "reader")

    def test_rest_key_is_injected_only_after_scope_validation(self) -> None:
        """Verify REST credentials are withheld until scope validation succeeds."""
        policy = Policy(
            {**self.config, "inject_credentials": True, "lab_ips": ["192.0.2.10"]},
            {"reader": self.token, "public": ""},
        )
        allowed = self.request("/catalog")
        del allowed.headers["x-api-key"]
        policy.request(allowed, "reader")
        self.assertNotIn("x-api-key", allowed.headers)
        policy.inject(allowed, "reader")
        self.assertEqual(allowed.headers["x-api-key"], self.token)

        for mutation in ("origin", "method", "path"):
            request = self.request("/catalog")
            del request.headers["x-api-key"]
            if mutation == "origin":
                request.host = "second.lab"
                request.headers["host"] = "second.lab:18080"
            elif mutation == "method":
                request.method = "POST"
            else:
                request.path = "/excluded/private"
            with self.subTest(mutation=mutation), self.assertRaises(PolicyError):
                policy.request(request, "reader")
            self.assertNotIn("x-api-key", request.headers)

        explicit_wrong = self.request("/catalog")
        explicit_wrong.headers["x-api-key"] = "another-key"
        with self.assertRaises(PolicyError):
            policy.request(explicit_wrong, "reader")

        remote = Policy(
            {**self.config, "inject_credentials": True},
            {"reader": self.token, "public": ""},
        )
        cleartext = self.request("/catalog")
        del cleartext.headers["x-api-key"]
        with self.assertRaisesRegex(PolicyError, "credential-transport"):
            remote.request(cleartext, "reader")
        self.assertNotIn("x-api-key", cleartext.headers)

    def test_rest_key_waits_for_numeric_pin_and_verified_peer(self) -> None:
        """Verify REST credentials require both numeric endpoint pinning and a
        verified connected peer.
        """

        class TestGateway(Gateway):
            def snapshot(self) -> None:
                pass

        class Resolver:
            def __init__(self, **_options: object) -> None:
                pass

            async def lookup_ip(self, _host: str) -> list[str]:
                return ["192.0.2.10"]

        gateway = TestGateway()
        gateway.policy = Policy(
            {**self.config, "inject_credentials": True, "lab_ips": ["192.0.2.10"]},
            {"reader": self.token, "public": ""},
        )
        gateway.budget = Budget(3, 4096, 1, 10)
        gateway.counts = Counter()
        gateway.profiles = {40000: "reader"}
        gateway.pending = {}
        gateway.expected_peers = {}
        gateway.verified_peers = set()
        gateway.verified_flow_peers = {}
        gateway.connection_flows = {}
        gateway.reservations = {}
        gateway.expired_roles = set()

        client = SimpleNamespace(
            id="client", sockname=("127.0.0.1", 40000), timestamp_end=None
        )
        server = SimpleNamespace(
            id="flow-server",
            connected=False,
            peername=None,
        )
        upstream = SimpleNamespace(
            id="upstream-server",
            address=("allowed.lab", 18080),
            connected=False,
            peername=None,
            sni=None,
            error=None,
        )

        def flow(
            identifier: str, flow_server: SimpleNamespace = server
        ) -> http.HTTPFlow:
            request = self.request("/catalog")
            del request.headers["x-api-key"]
            return cast(
                http.HTTPFlow,
                SimpleNamespace(
                    id=identifier,
                    client_conn=client,
                    server_conn=flow_server,
                    request=request,
                    metadata={},
                    response=None,
                ),
            )

        first = flow("first")
        with patch("policy.DnsResolver", Resolver):
            asyncio.run(gateway.requestheaders(first))
        gateway.request(first)
        self.assertNotIn("x-api-key", first.request.headers)
        self.assertEqual(gateway.counts["credential-injected"], 0)
        data = cast(
            ServerConnectionHookData, SimpleNamespace(client=client, server=upstream)
        )
        gateway.server_connect(data)
        self.assertEqual(gateway.counts["numeric-pins"], 1)
        self.assertNotIn("x-api-key", first.request.headers)
        upstream.connected = True
        upstream.peername = ("192.0.2.10", 18080)
        gateway.server_connected(data)
        self.assertEqual(gateway.counts["peer-verified"], 1)
        self.assertEqual(first.request.headers["x-api-key"], self.token)
        self.assertEqual(gateway.counts["credential-injected"], 1)
        gateway.release(first)
        self.assertNotIn("x-api-key", first.request.headers)

        server.connected = True
        server.peername = ("192.0.2.10", 18080)
        second = flow("second")
        with patch("policy.DnsResolver", Resolver):
            asyncio.run(gateway.requestheaders(second))
        gateway.request(second)
        self.assertEqual(second.request.headers["x-api-key"], self.token)
        self.assertEqual(gateway.counts["numeric-pins"], 1)
        self.assertEqual(gateway.counts["credential-injected"], 2)
        gateway.server_connect_error(data)
        self.assertNotIn("x-api-key", second.request.headers)
        self.assertEqual(gateway.budget.active, 0)

        failed_server = SimpleNamespace(
            id="failed-flow", connected=False, peername=None
        )
        failed_upstream = SimpleNamespace(
            id="failed-upstream",
            address=("allowed.lab", 18080),
            connected=False,
            peername=None,
            sni=None,
            error=None,
        )
        failed_data = cast(
            ServerConnectionHookData,
            SimpleNamespace(client=client, server=failed_upstream),
        )
        failed = flow("failed", failed_server)
        with patch("policy.DnsResolver", Resolver):
            asyncio.run(gateway.requestheaders(failed))
        gateway.request(failed)
        gateway.server_connect(failed_data)
        gateway.server_connect_error(failed_data)
        self.assertNotIn("x-api-key", failed.request.headers)
        self.assertEqual(gateway.counts["credential-injected"], 2)
        self.assertEqual(gateway.budget.active, 0)

        gateway.budget = Budget(1, 4096, 1, 10)
        wrong_port_side = SimpleNamespace(
            id="wrong-port-flow", connected=False, peername=None
        )
        wrong_port_upstream = SimpleNamespace(
            id="wrong-port-upstream",
            address=("allowed.lab", 18080),
            connected=False,
            peername=None,
            sni=None,
            error=None,
        )
        wrong_port_data = cast(
            ServerConnectionHookData,
            SimpleNamespace(client=client, server=wrong_port_upstream),
        )
        wrong_port_flow = flow("wrong-port-fresh", wrong_port_side)
        with patch("policy.DnsResolver", Resolver):
            asyncio.run(gateway.requestheaders(wrong_port_flow))
        gateway.request(wrong_port_flow)
        gateway.server_connect(wrong_port_data)
        before_fresh = gateway.counts["credential-injected"]
        wrong_port_upstream.connected = True
        wrong_port_upstream.peername = ("192.0.2.10", 18081)
        gateway.server_connected(wrong_port_data)
        fresh_wrong_port_injected = gateway.counts["credential-injected"] > before_fresh
        fresh_wrong_port_header = "x-api-key" in wrong_port_flow.request.headers
        fresh_wrong_port_active = gateway.budget.active
        gateway.server_connect_error(wrong_port_data)

        gateway.budget = Budget(2, 4096, 1, 10)
        reuse_side = SimpleNamespace(
            id="reuse-port-flow", connected=False, peername=None
        )
        reuse_upstream = SimpleNamespace(
            id="reuse-port-upstream",
            address=("allowed.lab", 18080),
            connected=False,
            peername=None,
            sni=None,
            error=None,
        )
        reuse_data = cast(
            ServerConnectionHookData,
            SimpleNamespace(client=client, server=reuse_upstream),
        )
        reuse_first = flow("reuse-port-first", reuse_side)
        with patch("policy.DnsResolver", Resolver):
            asyncio.run(gateway.requestheaders(reuse_first))
        gateway.request(reuse_first)
        gateway.server_connect(reuse_data)
        reuse_upstream.connected = True
        reuse_upstream.peername = ("192.0.2.10", 18080)
        gateway.server_connected(reuse_data)
        gateway.release(reuse_first)
        reuse_side.connected = True
        reuse_side.peername = ("192.0.2.10", 18081)
        reuse_wrong_port = flow("reuse-port-wrong", reuse_side)
        before_reuse = gateway.counts["credential-injected"]
        with patch("policy.DnsResolver", Resolver):
            asyncio.run(gateway.requestheaders(reuse_wrong_port))
        gateway.request(reuse_wrong_port)
        reuse_wrong_port_injected = gateway.counts["credential-injected"] > before_reuse
        reuse_wrong_port_header = "x-api-key" in reuse_wrong_port.request.headers
        reuse_wrong_port_active = gateway.budget.active
        gateway.server_connect_error(reuse_data)
        self.assertEqual(
            (
                fresh_wrong_port_injected,
                fresh_wrong_port_header,
                fresh_wrong_port_active,
                reuse_wrong_port_injected,
                reuse_wrong_port_header,
                reuse_wrong_port_active,
            ),
            (False, False, 0, False, False, 0),
        )
        baseline_after_ports = gateway.counts["credential-injected"]

        gateway.budget = Budget(1, 4096, 1, 10)
        original_side = SimpleNamespace(
            id="swap-original", connected=False, peername=None
        )
        swapped_upstream = SimpleNamespace(
            id="swap-upstream",
            address=("allowed.lab", 18080),
            connected=False,
            peername=None,
            sni=None,
            error=None,
        )
        swap_data = cast(
            ServerConnectionHookData,
            SimpleNamespace(client=client, server=swapped_upstream),
        )
        swapped = flow("swapped", original_side)
        with patch("policy.DnsResolver", Resolver):
            asyncio.run(gateway.requestheaders(swapped))
        gateway.request(swapped)
        gateway.server_connect(swap_data)
        swapped.server_conn = cast(
            connection.Server,
            SimpleNamespace(id="swap-replacement", connected=False, peername=None),
        )
        swapped_upstream.connected = True
        swapped_upstream.peername = ("192.0.2.10", 18080)
        gateway.verified_peers.add(swapped_upstream.id)
        with self.assertRaisesRegex(PolicyError, "pre-egress"):
            gateway.inject_verified(
                swapped, "reader", cast(connection.Server, swapped_upstream)
            )
        self.assertNotIn("x-api-key", swapped.request.headers)
        gateway.server_connected(swap_data)
        self.assertEqual(gateway.counts["credential-injected"], baseline_after_ports)
        self.assertNotIn("x-api-key", swapped.request.headers)
        self.assertEqual(gateway.budget.active, 0)
        self.assertNotIn(swapped.id, gateway.reservations)

        gateway.budget = Budget(2, 4096, 2, 10)
        colliding = [
            flow("collision-first", failed_server),
            flow("collision-second", failed_server),
        ]
        with patch("policy.DnsResolver", Resolver):
            for item in colliding:
                asyncio.run(gateway.requestheaders(item))
        for item in colliding:
            gateway.request(item)
            self.assertNotIn("x-api-key", item.request.headers)
        self.assertEqual(gateway.counts["credential-injected"], baseline_after_ports)
        self.assertEqual(gateway.budget.active, 0)

    def test_private_linklocal_metadata_multicast_mapped_and_mixed_answers_are_denied(
        self,
    ) -> None:
        """Verify private and special address classes, mapped forms and mixed DNS
        answers are rejected.
        """

        def result(address: str) -> tuple[int, int, int, str, tuple[str, int]]:
            """Build a resolver result containing the selected numeric address for
            address-policy cases.
            """
            return (
                socket.AF_INET6 if ":" in address else socket.AF_INET,
                socket.SOCK_STREAM,
                0,
                "",
                (address, 80),
            )

        for address in (
            "127.0.0.1",
            "10.0.0.1",
            "169.254.169.254",
            "224.0.0.1",
            "::1",
            "fe80::1",
            "::ffff:8.8.8.8",
        ):
            with self.assertRaises(PolicyError):
                self.policy.addresses([result(address)])
        self.assertEqual(self.policy.addresses([result("8.8.8.8")]), "8.8.8.8")
        with self.assertRaises(PolicyError):
            self.policy.addresses([result("8.8.8.8"), result("127.0.0.1")])

    def test_atomic_concurrency_request_and_byte_limits_do_not_refund(self) -> None:
        budget = Budget(requests=2, response_bytes=1024, concurrent=1, seconds=10)
        budget.reserve()
        with self.assertRaises(PolicyError):
            budget.reserve()
        self.assertFalse(budget.exhausted)
        budget.release()
        budget.reserve()
        self.assertEqual(budget.remaining, 0)
        budget.release()
        with self.assertRaises(PolicyError):
            budget.reserve()
        self.assertTrue(budget.exhausted)
        self.assertFalse(budget.consume(1025))
        self.assertEqual(budget.bytes_left, 0)


if __name__ == "__main__":
    unittest.main()
