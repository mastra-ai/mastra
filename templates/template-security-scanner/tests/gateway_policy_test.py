import secrets
import socket
import unittest
from urllib.parse import urlsplit

from mitmproxy import http

from policy import Budget, Policy, PolicyError, credential_variants


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

    def test_network_path_authority_is_never_discarded_before_policy(self) -> None:
        # Preserve the original lossy-predicate counterexample. No wire request
        # runs the old predicate; production Policy must reject all these forms.
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
        for encoded in credential_variants(self.token):
            self.assertTrue(self.policy.secret_in("/reflected?value=" + encoded))
        value = "".join(f"%{byte:02x}" for byte in self.token.encode())
        for _ in range(5):
            with self.assertRaises(PolicyError):
                self.policy.request(self.request("/reflected?value=" + value), "reader")
            value = value.replace("%", "%25")

    def test_origin_binding_host_body_upgrade_and_methods_are_authorized(self) -> None:
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

    def test_private_linklocal_metadata_multicast_mapped_and_mixed_answers_are_denied(
        self,
    ) -> None:
        def result(address: str) -> tuple[int, int, int, str, tuple[str, int]]:
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
