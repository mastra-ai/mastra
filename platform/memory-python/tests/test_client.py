import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from mastra_platform_memory import PlatformMemory, PlatformMemoryApiError


@pytest.fixture
def api():
    requests = []

    class Handler(BaseHTTPRequestHandler):
        def _handle(self):
            length = int(self.headers.get("content-length") or 0)
            body = json.loads(self.rfile.read(length)) if length else None
            requests.append({"method": self.command, "path": self.path, "headers": {k.lower(): v for k, v in self.headers.items()}, "body": body})
            if self.path.startswith("/v1/memory/mem_1/threads/chat%3A1/context"):
                self._json(200, {"system": "<obs>Ada lives in Kyoto</obs>", "messages": [{"id": "1", "role": "user", "content": "hi", "createdAt": ""}], "observedAt": None})
            elif self.path == "/v1/memory/mem_1/threads/chat%3A1/messages":
                self._json(201, {"messages": body["messages"]})
            elif self.path == "/v1/memory/mem_1/threads/missing":
                self._json(404, {"error": "not found"})
            elif self.path == "/v1/memory/mem_1/search":
                self._json(200, {"matches": [{"text": "Kyoto"}]})
            elif self.path.startswith("/v1/memory/mem_1/runs"):
                self._json(200, {"runs": [{"id": "run1", "observed": True}]})
            elif self.path.startswith("/v1/memory/mem_1/resources") and self.command == "GET":
                self._json(200, {"resources": [{"resourceId": "ada", "threadCount": 2}], "hasMore": False})
            elif self.path == "/v1/memory/mem_1/resources/ada" and self.command == "DELETE":
                self._json(200, {"deletedThreads": 2})
            elif self.path == "/v1/memory/mem_1/threads/t1" and self.command == "PATCH":
                self._json(200, {"id": "t1", **body})
            else:
                self._json(500, {"error": self.path})

        def _json(self, status, data):
            raw = json.dumps(data).encode()
            self.send_response(status)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        do_GET = do_POST = do_DELETE = do_PUT = do_PATCH = _handle

        def log_message(self, *args):
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_port}", requests
    server.shutdown()


def test_context_and_save_round_trip(api):
    url, requests = api
    memory = PlatformMemory(access_token="tok", instance_id="mem_1", api_url=url + "/", project_id="proj_1")

    context = memory.get_context("chat:1", resource_id="user-ada")
    assert context.as_chat_messages() == [
        {"role": "system", "content": "<obs>Ada lives in Kyoto</obs>"},
        {"role": "user", "content": "hi"},
    ]
    saved = memory.save_messages("chat:1", resource_id="user-ada", messages=[{"role": "user", "content": "yo"}])
    assert saved == [{"role": "user", "content": "yo"}]

    assert requests[0]["path"] == "/v1/memory/mem_1/threads/chat%3A1/context?resourceId=user-ada"
    assert requests[0]["headers"]["authorization"] == "Bearer tok"
    assert requests[0]["headers"]["x-mastra-project-id"] == "proj_1"
    assert requests[1]["body"] == {"resourceId": "user-ada", "messages": [{"role": "user", "content": "yo"}]}


def test_search_omits_unset_fields_and_missing_thread_is_none(api):
    url, requests = api
    memory = PlatformMemory(access_token="tok", instance_id="mem_1", api_url=url)
    assert memory.search("Kyoto", resource_id="user-ada") == [{"text": "Kyoto"}]
    assert requests[0]["body"] == {"resourceId": "user-ada", "query": "Kyoto"}
    assert memory.get_thread("missing") is None
    with pytest.raises(PlatformMemoryApiError) as error:
        memory.delete_thread("other")
    assert error.value.status == 500


def test_lists_observation_runs(api):
    url, requests = api
    memory = PlatformMemory(access_token="tok", instance_id="mem_1", api_url=url)
    assert memory.list_observation_runs(thread_id="t1", limit=5) == [{"id": "run1", "observed": True}]
    assert requests[0]["path"] == "/v1/memory/mem_1/runs?threadId=t1&limit=5"


def test_resources_and_rename(api):
    url, requests = api
    memory = PlatformMemory(access_token="tok", instance_id="mem_1", api_url=url)
    assert memory.list_resources(per_page=10)["resources"] == [{"resourceId": "ada", "threadCount": 2}]
    assert requests[0]["path"] == "/v1/memory/mem_1/resources?perPage=10"
    assert memory.delete_resource("ada") == 2
    assert memory.update_thread("t1", title="Renamed") == {"id": "t1", "title": "Renamed"}
    assert requests[2]["body"] == {"title": "Renamed"}
    assert memory.search("Kyoto") == [{"text": "Kyoto"}]
    assert requests[3]["body"] == {"query": "Kyoto"}


def test_reads_env_fallbacks(monkeypatch):
    monkeypatch.delenv("MASTRA_PLATFORM_ACCESS_TOKEN", raising=False)
    monkeypatch.setenv("MASTRA_PLATFORM_SECRET_KEY", "secret")
    monkeypatch.setenv("MASTRA_MEMORY_INSTANCE_ID", "mem_9")
    monkeypatch.setenv("MASTRA_PLATFORM_API_URL", "http://x")
    memory = PlatformMemory()
    assert memory.instance_id == "mem_9"
    assert memory.mcp_url == "http://x/v1/memory/mem_9/mcp"
    monkeypatch.delenv("MASTRA_MEMORY_INSTANCE_ID")
    with pytest.raises(ValueError):
        PlatformMemory()
