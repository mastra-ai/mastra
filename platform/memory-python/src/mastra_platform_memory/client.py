"""Client for the Platform Memory API (``/v1/memory/:instanceId/*``). Standard library only."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Literal, TypedDict

DEFAULT_API_URL = "https://platform.mastra.ai"


class Message(TypedDict):
    role: Literal["user", "assistant"]
    content: str


@dataclass
class Context:
    """Observations rendered as a system prompt, plus messages not yet observed."""

    system: str | None
    messages: list[Message]
    observed_at: str | None

    def as_chat_messages(self) -> list[dict[str, str]]:
        """OpenAI-style chat messages: the system block (if any) followed by the tail."""
        head = [{"role": "system", "content": self.system}] if self.system else []
        return head + [{"role": m["role"], "content": m["content"]} for m in self.messages]


class PlatformMemoryApiError(Exception):
    def __init__(self, status: int, body: str) -> None:
        super().__init__(f"Platform Memory request failed with {status}{': ' + body if body else ''}")
        self.status = status
        self.body = body


def _env(name: str) -> str | None:
    value = os.environ.get(name, "").strip()
    return value or None


class PlatformMemory:
    """Hosted Platform Memory. Configuration falls back to ``MASTRA_PLATFORM_*`` env vars.

    Typical turn::

        memory = PlatformMemory()
        context = memory.get_context(thread_id, resource_id=user_id)
        reply = llm(context.as_chat_messages() + [{"role": "user", "content": text}])
        memory.save_messages(thread_id, resource_id=user_id, messages=[
            {"role": "user", "content": text},
            {"role": "assistant", "content": reply},
        ])
    """

    def __init__(
        self,
        *,
        access_token: str | None = None,
        instance_id: str | None = None,
        project_id: str | None = None,
        environment_id: str | None = None,
        acting_user_id: str | None = None,
        api_url: str | None = None,
        timeout: float = 30.0,
    ) -> None:
        token = access_token or _env("MASTRA_PLATFORM_ACCESS_TOKEN") or _env("MASTRA_PLATFORM_SECRET_KEY")
        instance = instance_id or _env("MASTRA_MEMORY_INSTANCE_ID")
        if not token:
            raise ValueError("PlatformMemory: access_token is required")
        if not instance:
            raise ValueError("PlatformMemory: instance_id is required")
        self.instance_id = instance
        self._token = token
        self._project_id = project_id or _env("MASTRA_PROJECT_ID")
        self._environment_id = environment_id or _env("MASTRA_ENVIRONMENT_ID")
        self._acting_user_id = acting_user_id
        api = (api_url or _env("MASTRA_PLATFORM_API_URL") or DEFAULT_API_URL).rstrip("/")
        self._base = f"{api}/v1/memory/{urllib.parse.quote(instance, safe='')}"
        self._timeout = timeout

    @property
    def mcp_url(self) -> str:
        return f"{self._base}/mcp"

    def get_context(self, thread_id: str, *, resource_id: str) -> Context:
        res = self._request("GET", f"/threads/{_q(thread_id)}/context", query={"resourceId": resource_id})
        return Context(system=res["system"], messages=res["messages"], observed_at=res.get("observedAt"))

    def save_messages(self, thread_id: str, *, resource_id: str, messages: list[Message]) -> list[dict[str, Any]]:
        """Saves messages and schedules observation in the background. Creates the thread if needed."""
        body = {"resourceId": resource_id, "messages": [{"role": m["role"], "content": m["content"]} for m in messages]}
        return self._request("POST", f"/threads/{_q(thread_id)}/messages", body=body)["messages"]

    def list_messages(self, thread_id: str, *, page: int | None = None, per_page: int | None = None) -> dict[str, Any]:
        return self._request("GET", f"/threads/{_q(thread_id)}/messages", query={"page": page, "perPage": per_page})

    def list_threads(
        self, *, resource_id: str | None = None, page: int | None = None, per_page: int | None = None
    ) -> dict[str, Any]:
        return self._request("GET", "/threads", query={"resourceId": resource_id, "page": page, "perPage": per_page})

    def create_thread(
        self,
        *,
        resource_id: str,
        id: str | None = None,
        title: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        body = {"resourceId": resource_id, "id": id, "title": title, "metadata": metadata}
        return self._request("POST", "/threads", body={k: v for k, v in body.items() if v is not None})

    def get_thread(self, thread_id: str) -> dict[str, Any] | None:
        try:
            return self._request("GET", f"/threads/{_q(thread_id)}")
        except PlatformMemoryApiError as error:
            if error.status == 404:
                return None
            raise

    def delete_thread(self, thread_id: str) -> None:
        self._request("DELETE", f"/threads/{_q(thread_id)}")

    def get_working_memory(self, *, resource_id: str) -> str | None:
        return self._request("GET", "/working-memory", query={"resourceId": resource_id})["workingMemory"]

    def update_working_memory(self, *, resource_id: str, working_memory: str) -> None:
        self._request("PUT", "/working-memory", body={"resourceId": resource_id, "workingMemory": working_memory})

    def search(
        self, query: str, *, resource_id: str, thread_id: str | None = None, limit: int | None = None
    ) -> list[dict[str, Any]]:
        body = {"resourceId": resource_id, "threadId": thread_id, "query": query, "limit": limit}
        return self._request("POST", "/search", body={k: v for k, v in body.items() if v is not None})["matches"]

    def _request(
        self, method: str, path: str, *, query: dict[str, Any] | None = None, body: Any = None
    ) -> Any:
        params = {k: str(v) for k, v in (query or {}).items() if v is not None}
        url = self._base + path + (f"?{urllib.parse.urlencode(params)}" if params else "")
        headers = {"authorization": f"Bearer {self._token}"}
        if self._acting_user_id:
            headers["x-acting-user-id"] = self._acting_user_id
        if self._project_id:
            headers["x-mastra-project-id"] = self._project_id
        if self._environment_id:
            headers["x-mastra-environment-id"] = self._environment_id
        data = None
        if body is not None:
            headers["content-type"] = "application/json"
            data = json.dumps(body).encode()
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=self._timeout) as res:
                raw = res.read()
        except urllib.error.HTTPError as error:
            raise PlatformMemoryApiError(error.code, error.read().decode(errors="replace")) from None
        return json.loads(raw) if raw else None


def _q(value: str) -> str:
    return urllib.parse.quote(value, safe="")
