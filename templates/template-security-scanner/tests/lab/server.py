from __future__ import annotations

import datetime
import json
import os
import socket
import ssl
import struct
import threading
import time
from collections import Counter
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

profiles = json.loads(Path("/workspace/profiles.json").read_text())
secrets = {role: profile["value"] for role, profile in profiles.items()}
counts: Counter[str] = Counter()
control_ports = {role: 40000 for role in profiles}
dns_state = {"mode": "allow", "round": 0}
expired_roles = set()
lock = threading.Lock()
network_path = Path("/workspace/network.json")
network = (
    json.loads(network_path.read_text())
    if network_path.exists()
    else {
        "allowedIp": socket.gethostbyname(socket.gethostname()),
        "deniedIp": "192.0.2.255",
    }
)


def dns_name(value):
    return (
        b"".join(bytes([len(label)]) + label.encode() for label in value.split("."))
        + b"\0"
    )


def dns_server():
    receiver = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    receiver.bind(("0.0.0.0", 53))
    while True:
        packet, peer = receiver.recvfrom(4096)
        with lock:
            counts["dns-packets"] += 1
            counts[f"dns-from-{peer[0]}"] += 1
        if not 12 <= len(packet) <= 512:
            continue
        offset, labels = 12, []
        try:
            for _ in range(16):
                size = packet[offset]
                offset += 1
                if size == 0:
                    break
                if size > 63 or offset + size > len(packet):
                    raise ValueError("query-bound")
                labels.append(packet[offset : offset + size].decode("ascii"))
                offset += size
            kind, record_class = struct.unpack("!HH", packet[offset : offset + 4])
            if record_class != 1:
                continue
            question = packet[12 : offset + 4]
            host = ".".join(labels)
            mode = dns_state["mode"]
            if mode == "timeout":
                continue
            if kind == 1:
                dns_state["round"] += 1
            records = []
            if mode == "malformed":
                receiver.sendto(packet[:2] + b"\xff" * 20, peer)
                continue
            if mode == "cname" and host == "allowed.lab":
                alias = dns_name("alias.allowed.lab")
                records.append(
                    b"\xc0\x0c" + struct.pack("!HHIH", 5, 1, 0, len(alias)) + alias
                )
            elif kind == 1:
                addresses = [network["allowedIp"]]
                if mode == "mixed":
                    addresses.append(network["deniedIp"])
                elif mode == "many":
                    addresses += ["192.0.2." + str(index) for index in range(1, 34)]
                elif mode == "denied" or mode == "rebind" and dns_state["round"] > 1:
                    addresses = [network["deniedIp"]]
                for address in addresses:
                    records.append(
                        b"\xc0\x0c"
                        + struct.pack("!HHIH", 1, 1, 0, 4)
                        + socket.inet_aton(address)
                    )
            elif kind == 28 and mode == "mapped":
                raw = socket.inet_pton(
                    socket.AF_INET6, "::ffff:" + network["allowedIp"]
                )
                records.append(b"\xc0\x0c" + struct.pack("!HHIH", 28, 1, 0, 16) + raw)
            response = (
                packet[:2]
                + struct.pack("!5H", 0x8180, 1, len(records), 0, 0)
                + question
                + b"".join(records)
            )
            receiver.sendto(response, peer)
        except (ValueError, IndexError, struct.error, UnicodeError):
            continue


threading.Thread(target=dns_server, daemon=True).start()


def udp_receiver(port):
    receiver = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    receiver.bind(("0.0.0.0", port))
    while True:
        _packet, peer = receiver.recvfrom(4096)
        with lock:
            counts[f"udp-{port}"] += 1
        receiver.sendto(b"owned-negative-receiver", peer)


for port in (443, 3478):
    threading.Thread(target=udp_receiver, args=(port,), daemon=True).start()

# An owned listener with no accept loop deterministically bounds the backlog.
# It exercises cancellation while the gateway's upstream connect is pending.
pending_listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
pending_listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
pending_listener.bind(("0.0.0.0", 18082))
pending_listener.listen(1)


def root_certificate(name):
    key = ec.generate_private_key(ec.SECP256R1())
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, name)])
    now = datetime.datetime.now(datetime.timezone.utc)
    certificate = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=2))
        .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
        .sign(key, hashes.SHA256())
    )
    return key, certificate


lab_key, lab_root = root_certificate("owned-lab-root")
Path("/workspace/lab-root.pem").write_bytes(
    lab_root.public_bytes(serialization.Encoding.PEM)
)
os.chmod("/workspace/lab-root.pem", 0o600)


def server_context(name, host, expired=False, untrusted=False):
    key = ec.generate_private_key(ec.SECP256R1())
    issuer_key, issuer = (
        root_certificate("untrusted-owned-root") if untrusted else (lab_key, lab_root)
    )
    now = datetime.datetime.now(datetime.timezone.utc)
    before, after = (
        (now - datetime.timedelta(days=3), now - datetime.timedelta(days=2))
        if expired
        else (now - datetime.timedelta(hours=1), now + datetime.timedelta(days=1))
    )
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, host)])
    certificate = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer.subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(before)
        .not_valid_after(after)
        .add_extension(
            x509.SubjectAlternativeName([x509.DNSName(host)]), critical=False
        )
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(
            x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False
        )
        .sign(issuer_key, hashes.SHA256())
    )
    cert_path, key_path = f"/workspace/{name}.pem", f"/workspace/{name}.key"
    Path(cert_path).write_bytes(certificate.public_bytes(serialization.Encoding.PEM))
    Path(key_path).write_bytes(
        key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
    )
    os.chmod(cert_path, 0o600)
    os.chmod(key_path, 0o600)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    context.load_cert_chain(cert_path, key_path)
    return context


class Receiver(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, handler, tls_context=None):
        self.tls_context = tls_context
        super().__init__(address, handler)

    def get_request(self):
        connection, address = super().get_request()
        if self.server_port != 18090:
            with lock:
                counts[f"tcp-{self.server_port}"] += 1
        if self.tls_context:
            with lock:
                counts[f"tls-attempt-{self.server_port}"] += 1
            connection.settimeout(3)
            try:
                connection = self.tls_context.wrap_socket(connection, server_side=True)
                with lock:
                    counts[f"tls-success-{self.server_port}"] += 1
            except ssl.SSLError:
                with lock:
                    counts[f"tls-error-{self.server_port}"] += 1
                connection.close()
                raise
        return connection, address


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):
        pass

    def respond(self, status, body, headers=None):
        self.send_response(status)
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        if "Content-Type" not in (headers or {}):
            self.send_header("Content-Type", "text/html")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.server.server_port == 18090:
            if self.path.startswith("/expire?"):
                from urllib.parse import parse_qs

                role = parse_qs(urlsplit(self.path).query).get("role", [""])[0]
                if role in secrets:
                    expired_roles.add(role)
            if self.path.startswith("/dns?"):
                from urllib.parse import parse_qs

                mode = parse_qs(urlsplit(self.path).query).get("mode", [""])[0]
                if mode in {
                    "allow",
                    "mixed",
                    "denied",
                    "rebind",
                    "mapped",
                    "cname",
                    "malformed",
                    "timeout",
                    "many",
                }:
                    dns_state["mode"], dns_state["round"] = mode, 0
            if self.path.startswith("/control?"):
                from urllib.parse import parse_qs

                values = parse_qs(urlsplit(self.path).query)
                role = values.get("role", [""])[0]
                port = int(values.get("port", ["0"])[0])
                if role in control_ports and 40000 <= port <= 40031:
                    control_ports[role] = port
            with lock:
                self.respond(200, json.dumps(dict(counts)).encode())
            return
        path = "/".join(
            segment.split(";", 1)[0] for segment in urlsplit(self.path).path.split("/")
        )
        with lock:
            counts[f"http-{self.server.server_port}"] += 1
            if any(secret and secret in self.path for secret in secrets.values()):
                counts["credential-url-contacts"] += 1
            if path.startswith("/excluded"):
                counts["excluded-contacts"] += 1
            if self.headers.get("Host", "").startswith("second.lab") and any(
                self.headers.get(profile["name"])
                for profile in profiles.values()
                if profile["name"]
            ):
                counts["cross-origin-credential-contacts"] += 1
        role = next(
            (
                role
                for role, profile in profiles.items()
                if profile["name"]
                and self.headers.get(profile["name"]) == profile["value"]
            ),
            "public"
            if not any(
                self.headers.get(name)
                for name in ("authorization", "cookie", "x-test-identity", "x-api-key")
            )
            else None,
        )
        if role is None or role in expired_roles:
            with lock:
                counts["unauthorized"] += 1
            self.respond(401, b"authentication-required")
            return
        with lock:
            counts[f"authorized-{role}"] += 1
            if path == "/start":
                counts["start-contacts"] += 1
            elif path == "/identity":
                counts["identity-contacts"] += 1
            elif path == "/api/clean":
                counts[f"clean-xhr-{role}"] += 1
        if path == "/identity":
            self.respond(
                200,
                json.dumps({"identity": f"{role}-account", "role": role}).encode(),
                {"Content-Type": "application/json"},
            )
        elif path == "/admin" and role != "admin":
            self.respond(403, b"role-access-denied")
        elif path == "/start":
            # The owned server intentionally reflects another identity's previous secret.
            reflected = (
                secrets["viewer"]
                if role == "admin"
                else (secrets[role] or "public-resource")
            )
            body = f'''<!doctype html><html><body><a href="/catalog?category=books">Catalog</a><a href="/admin">Administration</a><form action="/search" method="get"><input name="q"></form><a href="/reflected?value={reflected}">Reflected</a><form action="/submit?ref={reflected}" method="get"><input name="{reflected}"></form><script>fetch('/api/clean?sort=recent');fetch('/api/events?token={reflected}');fetch('/write',{{method:'POST',body:'bounded-write'}});navigator.sendBeacon('/beacon','bounded-beacon');new WebSocket('ws://allowed.lab:18080/socket');</script></body></html>'''.encode()
            loopback = b"""<script>setTimeout(()=>fetch('/control-info').then(r=>r.json()).then(info=>{fetch('http://127.0.0.1:9222/json/version').catch(()=>{});fetch('http://127.0.0.1:'+info.port+'/guard').catch(()=>{});new WebSocket('ws://127.0.0.1:9222/devtools/browser/invalid');}),1500);</script>"""
            self.respond(200, body + loopback, {"X-Reflected": reflected})
        elif path == "/control-info":
            self.respond(200, json.dumps({"port": control_ports[role]}).encode())
        elif path == "/redirect-denied":
            self.respond(302, b"", {"Location": "http://denied.lab:18081/nope"})
        elif path == "/redirect-second":
            self.respond(302, b"", {"Location": "http://second.lab:18080/nope"})
        elif path == "/redirect-path":
            self.respond(302, b"", {"Location": "/excluded/nope"})
        elif path == "/large":
            self.respond(200, b"x" * 131072)
        elif path == "/output-bound":
            name = "field" + "x" * 7900
            self.respond(
                200,
                (
                    "<html><form action='/search'>"
                    + "".join(f"<input name='{name}{index}'>" for index in range(4))
                    + "</form></html>"
                ).encode(),
                {"X-Bounded-Metadata": "z" * 16000},
            )
        elif path in {"/slow", "/stream", "/hold"}:
            if path == "/stream":
                with lock:
                    counts["stream-contacts"] += 1
            self.send_response(200)
            self.send_header("Content-Length", "24")
            self.end_headers()
            self.wfile.write(b"partial-")
            self.wfile.flush()
            time.sleep(8 if path in {"/slow", "/stream"} else 1)
            try:
                self.wfile.write(b"completed-stream")
                self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass
        else:
            self.respond(200, b"<html><body>Allowed inventory</body></html>")

    def do_POST(self):
        with lock:
            counts["write-contacts"] += 1
            counts[f"http-{self.server.server_port}"] += 1
        self.respond(405, b"writes-disabled")


servers = [Receiver(("0.0.0.0", port), Handler) for port in (53, 18080, 18081, 18090)]
servers += [
    Receiver(("0.0.0.0", 18443), Handler, server_context("valid", "allowed.lab")),
    Receiver(("0.0.0.0", 18444), Handler, server_context("wrong", "wrong.lab")),
    Receiver(
        ("0.0.0.0", 18445),
        Handler,
        server_context("expired", "allowed.lab", expired=True),
    ),
    Receiver(
        ("0.0.0.0", 18446),
        Handler,
        server_context("untrusted", "allowed.lab", untrusted=True),
    ),
]
for server in servers:
    threading.Thread(target=server.serve_forever, daemon=True).start()
threading.Event().wait()
