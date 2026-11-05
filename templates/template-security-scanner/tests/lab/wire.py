import http.client
import json
import socket
import sys
import time
from pathlib import Path
from urllib.parse import urlsplit


def main() -> None:
    """Execute the selected owned gateway wire scenario and emit its bounded observed
    result.
    """
    case = sys.argv[2]
    if case == "raw-connect":
        result = {
            "case": case,
            "status": None,
            "upstreamObserved": False,
            "policyDenied": False,
            "bytes": 0,
            "record": None,
        }
        with socket.create_connection((sys.argv[1], 8080), timeout=2) as tunnel:
            tunnel.sendall(
                b"CONNECT allowed.lab:18443 HTTP/1.1\r\nHost: allowed.lab:18443\r\n\r\n"
            )
            headers = bytearray()
            while not headers.endswith(b"\r\n\r\n"):
                chunk = tunnel.recv(1)
                if not chunk or len(headers) >= 4096:
                    raise RuntimeError("OWNED_CONNECT_HEADER_BOUND")
                headers.extend(chunk)
            result["status"] = int(headers.split(b" ", 2)[1])
            tunnel.sendall(b"owned-non-http-tunnel")
            tunnel.shutdown(socket.SHUT_WR)
            tunnel.settimeout(0.2)
            try:
                result["bytes"] = len(tunnel.recv(256))
            except (OSError, TimeoutError):
                pass
        print(json.dumps(result))
        return
    if case == "disconnect-neighbors":
        results = []

        def state():
            return json.loads(Path("/workspace/gateway-stats.json").read_text())

        def connect(path):
            client = http.client.HTTPConnection(sys.argv[1], 8080, timeout=3)
            client.request(
                "GET",
                "http://allowed.lab:18080" + path,
                headers={"Host": "allowed.lab:18080"},
            )
            return client, client.getresponse()

        initial = state()
        for _ in range(20):
            survivor, alive = connect("/hold")
            before_open = state()["counts"].get("numeric-pins", 0)
            cancelled = http.client.HTTPConnection(sys.argv[1], 8080, timeout=3)
            cancelled.request(
                "GET",
                "http://allowed.lab:18082/catalog",
                headers={"Host": "allowed.lab:18082"},
            )
            deadline = time.monotonic() + 0.7
            while (
                state()["counts"].get("numeric-pins", 0) == before_open
                and time.monotonic() < deadline
            ):
                time.sleep(0.005)
            assert state()["counts"].get("numeric-pins", 0) == before_open + 1
            saturated, denied = connect("/catalog")
            assert (
                denied.status == 403
                and denied.getheader("X-Scanner-Policy-Denied") == "1"
            )
            denied.read()
            saturated.close()
            assert state()["active"] == 2
            cancelled.close()
            deadline = time.monotonic() + 0.7
            while state()["active"] == 2 and time.monotonic() < deadline:
                time.sleep(0.005)
            assert state()["active"] == 1
            adjacent, accepted = connect("/catalog")
            assert accepted.status == 200
            accepted.read()
            adjacent.close()
            deadline = time.monotonic() + 0.7
            while state()["active"] == 2 and time.monotonic() < deadline:
                time.sleep(0.005)
            assert state()["active"] == 1
            assert alive.status == 200 and len(alive.read()) == 24
            survivor.close()
            deadline = time.monotonic() + 0.7
            while state()["active"] and time.monotonic() < deadline:
                time.sleep(0.005)
            assert state()["active"] == 0
            results.append(True)
        final = state()
        print(
            json.dumps(
                {
                    "repetitions": len(results),
                    "remainingRequestDelta": initial["remainingRequests"]
                    - final["remainingRequests"],
                    "active": final["active"],
                    "exhausted": final["exhausted"],
                    "openingCancellationObserved": final["counts"].get(
                        "server-connect-errors", 0
                    )
                    - initial["counts"].get("server-connect-errors", 0)
                    >= 18,
                }
            )
        )
        return
    targets = {
        "first-denied-origin": "http://denied.lab:18081/nope",
        "double-slash": "http://allowed.lab:18080//excluded/nope",
        "triple-slash": "http://allowed.lab:18080///excluded/nope",
        "encoded-double-slash": "http://allowed.lab:18080/%2fexcluded/nope",
        "semicolon": "http://allowed.lab:18080/excluded;param/nope",
        "encoded-semicolon": "http://allowed.lab:18080/excluded%3bparam/nope",
        "clean": "http://allowed.lab:18080/catalog?category=books",
        "clean-json": "http://allowed.lab:18080/catalog.json",
        "upstream-forbidden": "http://allowed.lab:18080/admin",
        "tls-invalid": "https://allowed.lab:18444/catalog",
        "tls-valid": "https://allowed.lab:18443/catalog",
        "websocket": "http://allowed.lab:18080/socket",
        "write": "http://allowed.lab:18080/write",
        "host-mismatch": "http://allowed.lab:18080/catalog",
    }
    target = targets[case]
    connection = http.client.HTTPConnection(sys.argv[1], 8080, timeout=4)
    result = {
        "case": case,
        "status": None,
        "upstreamObserved": False,
        "policyDenied": False,
        "bytes": 0,
        "record": None,
    }
    try:
        # Keep the absolute request-target, including its ambiguous raw path.
        method = "POST" if case == "write" else "GET"
        connection.putrequest(method, target, skip_host=True, skip_accept_encoding=True)
        connection.putheader(
            "Host",
            "denied.lab:18081" if case == "host-mismatch" else urlsplit(target).netloc,
        )
        if case == "websocket":
            connection.putheader("Upgrade", "websocket")
            connection.putheader("Connection", "Upgrade")
            connection.putheader("Sec-WebSocket-Key", "b3duZWQtY2FuYXJ5LWtleQ==")
        if case == "write":
            connection.putheader("Content-Length", "1")
        connection.endheaders(b"x" if case == "write" else None)
        response = connection.getresponse()
        result.update(
            {
                "status": response.status,
                "upstreamObserved": response.getheader("X-Scanner-Upstream-Observed")
                == "1",
                "policyDenied": response.getheader("X-Scanner-Policy-Denied") == "1",
                "bytes": len(response.read(65536)),
            }
        )
        # Feed only actual status and trusted marker headers into the product
        # parser. No receiver body or arbitrary response metadata is exported.
        markers = {
            name: response.getheader(name)
            for name in ("X-Scanner-Upstream-Observed", "X-Scanner-Policy-Denied")
            if response.getheader(name) is not None
        }
        result["record"] = {
            "request": {"endpoint": target, "method": method},
            "response": {"status_code": response.status, "headers": markers},
        }
    except (OSError, http.client.HTTPException):
        pass
    finally:
        connection.close()
    print(json.dumps(result))


if __name__ == "__main__":
    main()
