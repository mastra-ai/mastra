"""Bounded fixed-shape GET verification inside the isolated gateway ingress network."""

import json
import re
import ssl
import urllib.error
import urllib.request
from pathlib import Path


MARKER = re.compile(rb"LAB_MARKER_[A-Z0-9]{8,64}")
PROXY = re.compile(r"http://(?:[0-9]{1,3}\.){3}[0-9]{1,3}:(?:808[0-9]|809[0-9]|810[0-9]|811[01])\Z")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        return None


def request_item(item, ca):
    if item.get("method") != "GET" or not PROXY.fullmatch(item.get("proxy", "")):
        return {"code": "INVALID_REQUEST"}
    if not isinstance(item.get("url"), str) or len(item["url"]) > 2048:
        return {"code": "INVALID_REQUEST"}
    headers = {}
    try:
        for line in Path(item["headersFile"]).read_text().splitlines():
            name, value = line.split(": ", 1)
            if not re.fullmatch(r"[A-Za-z0-9-]{1,80}", name) or len(value) > 4096:
                return {"code": "INVALID_HEADERS"}
            headers[name] = value
        if item.get("invalidSession") is True:
            for name in ("Authorization", "authorization", "Cookie", "cookie", "X-Api-Key", "x-api-key", "X-Test-Identity", "x-test-identity"):
                headers.pop(name, None)
            headers["Authorization"] = "Bearer invalid-scanner-session"
        opener = urllib.request.build_opener(
            urllib.request.ProxyHandler({"http": item["proxy"], "https": item["proxy"]}),
            urllib.request.HTTPSHandler(context=ssl.create_default_context(cafile=ca)),
            NoRedirect(),
        )
        request = urllib.request.Request(item["url"], headers=headers, method="GET")
        try:
            response = opener.open(request, timeout=4)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            body = response.read(8193)
            if len(body) > 8192:
                return {"code": "RESPONSE_BOUND"}
            marker = MARKER.search(body)
            return {
                "code": "COMPLETE",
                "status": response.status,
                "marker": marker.group().decode("ascii") if marker else None,
            }
    except (OSError, ValueError, ssl.SSLError, urllib.error.URLError):
        return {"code": "NETWORK_FAILURE"}


def main():
    try:
        data = json.loads(Path("/workspace/request.json").read_text())
        requests = data["requests"]
        if not isinstance(requests, list) or not 1 <= len(requests) <= 4:
            raise ValueError("request count")
        results = [request_item(item, "/workspace/mitm-ca.pem") for item in requests]
        print(json.dumps({"results": results}, separators=(",", ":")))
    except (OSError, ValueError, KeyError, TypeError):
        print('{"code":"INVALID_VERIFIER_INPUT"}')


if __name__ == "__main__":
    main()
