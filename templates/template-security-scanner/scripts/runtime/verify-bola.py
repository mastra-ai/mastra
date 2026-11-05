"""Read exactly one observed owner resource with two bound gateway identities."""

import hashlib
import json
import re
import ssl
import urllib.error
import urllib.request
from pathlib import Path

PROXY = re.compile(r"http://(?:[0-9]{1,3}\.){3}[0-9]{1,3}:80[0-9]{2}\Z")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        return None


def read(item: dict, ca: str) -> dict:
    """Perform one validated BOLA read through the configured gateway and return its
    bounded response evidence.
    """
    if set(item) != {"url", "proxy"} or not PROXY.fullmatch(item["proxy"]):
        return {"code": "INVALID_REQUEST"}
    if not isinstance(item["url"], str) or len(item["url"]) > 2048:
        return {"code": "INVALID_REQUEST"}
    try:
        opener = urllib.request.build_opener(
            urllib.request.ProxyHandler({"http": item["proxy"], "https": item["proxy"]}),
            urllib.request.HTTPSHandler(context=ssl.create_default_context(cafile=ca)),
            NoRedirect(),
        )
        request = urllib.request.Request(item["url"], method="GET")
        try:
            response = opener.open(request, timeout=4)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            body = response.read(8193)
            if len(body) > 8192:
                return {"code": "RESPONSE_BOUND"}
            observed = response.headers.get("X-Scanner-Upstream-Observed") == "1"
            media_type = response.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
            digest = None
            if response.status == 200 and media_type == "application/json":
                parsed = json.loads(body)
                if not isinstance(parsed, (dict, list)):
                    return {"code": "INVALID_JSON"}
                digest = hashlib.sha256(body).hexdigest()
            return {"code": "COMPLETE", "status": response.status, "upstreamObserved": observed, "bodySha256": digest}
    except (OSError, ValueError, UnicodeError, ssl.SSLError, urllib.error.URLError):
        return {"code": "NETWORK_FAILURE"}


def main():
    """Read exactly two BOLA requests from the private request file and emit their
    bounded results.
    """
    try:
        requests = json.loads(Path("/workspace/request.json").read_text())["requests"]
        if not isinstance(requests, list) or len(requests) != 2:
            raise ValueError("request count")
        print(json.dumps({"results": [read(item, "/workspace/mitm-ca.pem") for item in requests]}, separators=(",", ":")))
    except (OSError, ValueError, KeyError, TypeError):
        print('{"code":"INVALID_VERIFIER_INPUT"}')


if __name__ == "__main__":
    main()
