#!/usr/bin/env bash
# Injects 7 days of historical test data into the running example app.
# Usage: bash examples/agent/scripts/inject-test-data.sh
#
# Requires: curl, python3
# Server must be running at localhost:4111
# Requires debug routes in examples/agent/src/mastra/index.ts

set -euo pipefail

echo "=== Injecting historical test data ==="

# ---------- 1. Scores (via POST /debug/inject-scores) ----------
echo ""
echo "--- Injecting scores ---"

python3 << 'PYEOF'
import json, random, subprocess, datetime

now = datetime.datetime.utcnow()
scorer_id = "answer-relevancy-scorer"
base_url = "http://localhost:4111"

scores = []
for day_offset in range(7):
    day = now - datetime.timedelta(days=day_offset)
    scores_per_day = random.randint(3, 7) if day_offset < 3 else random.randint(1, 4)

    for i in range(scores_per_day):
        ts = day - datetime.timedelta(
            hours=random.randint(0, 23),
            minutes=random.randint(0, 59),
            seconds=random.randint(0, 59),
        )
        score_val = round(random.uniform(0.3, 1.0), 2)
        scores.append({
            "scorerId": scorer_id,
            "score": score_val,
            "label": "answer-relevancy",
            "metadata": {"injected": True, "day_offset": day_offset},
            "createdAt": ts.isoformat() + "Z",
        })

payload = json.dumps({"scores": scores})
result = subprocess.run(
    ["curl", "-s", "-X", "POST", f"{base_url}/debug/inject-scores",
     "-H", "Content-Type: application/json", "-d", payload],
    capture_output=True, text=True,
)
print(f"Scores: {result.stdout.strip()} (total: {len(scores)})")
PYEOF

# ---------- 2. Metrics — eval-agent with gpt-4o ----------
echo ""
echo "--- Injecting eval-agent metrics ---"

python3 << 'PYEOF'
import json, random, subprocess, datetime

now = datetime.datetime.utcnow()
metrics = []

for day_offset in range(7):
    day = now - datetime.timedelta(days=day_offset)
    runs_per_day = random.randint(8, 20) if day_offset < 3 else random.randint(3, 8)

    for run in range(runs_per_day):
        ts = day - datetime.timedelta(
            hours=random.randint(0, 23),
            minutes=random.randint(0, 59),
            seconds=random.randint(0, 59),
        )
        ts_str = ts.strftime("%Y-%m-%dT%H:%M:%SZ")

        agent = "eval-agent"
        model = "gpt-4o"
        status = "ok" if random.random() > 0.15 else "error"
        duration = random.randint(200, 5000) if status == "ok" else random.randint(50, 300)
        trace_id = f"trace-{day_offset}-{run}"
        span_id = f"span-{day_offset}-{run}"

        metrics.append({
            "timestamp": ts_str,
            "name": "mastra_agent_duration_ms",
            "value": duration,
            "labels": {"status": status},
            "entityType": "AGENT",
            "entityName": agent,
            "traceId": trace_id,
            "spanId": span_id + "-agent",
        })

        input_tokens = random.randint(50, 500)
        output_tokens = random.randint(20, 300)
        cache_read = random.randint(0, input_tokens // 3)
        cache_write = random.randint(0, input_tokens // 5)

        for metric_name, value in [
            ("mastra_model_total_input_tokens", input_tokens),
            ("mastra_model_total_output_tokens", output_tokens),
            ("mastra_model_input_cache_read_tokens", cache_read),
            ("mastra_model_input_cache_write_tokens", cache_write),
        ]:
            metrics.append({
                "timestamp": ts_str,
                "name": metric_name,
                "value": value,
                "labels": {"model": model, "provider": "openai"},
                "entityType": "AGENT",
                "entityName": agent,
                "traceId": trace_id,
                "spanId": span_id + "-model",
            })

        if random.random() > 0.4:
            tool_duration = random.randint(50, 2000)
            metrics.append({
                "timestamp": ts_str,
                "name": "mastra_tool_duration_ms",
                "value": tool_duration,
                "labels": {"status": "ok"},
                "entityType": "TOOL",
                "entityName": "cooking-tool",
                "traceId": trace_id,
                "spanId": span_id + "-tool",
            })

batch_size = 50
total = len(metrics)
for i in range(0, total, batch_size):
    batch = metrics[i:i+batch_size]
    payload = json.dumps({"metrics": batch})
    subprocess.run(
        ["curl", "-s", "-X", "POST", "http://localhost:4111/debug/inject-metrics",
         "-H", "Content-Type: application/json", "-d", payload],
        capture_output=True, text=True,
    )

print(f"Eval-agent metrics injected: {total}")
PYEOF

# ---------- 3. Metrics — multi-model, multi-agent ----------
echo ""
echo "--- Injecting multi-model metrics ---"

python3 << 'PYEOF'
import json, random, subprocess, datetime

now = datetime.datetime.utcnow()
metrics = []

models = [
    ("gpt-4o-mini", "openai"),
    ("gpt-4.1-nano", "openai"),
    ("o3-mini", "openai"),
    ("claude-opus-4-6", "anthropic"),
    ("claude-sonnet-4-6", "anthropic"),
    ("claude-haiku-4-5-20251001", "anthropic"),
    ("gemini-2.0-flash", "google"),
    ("gemini-2.5-pro", "google"),
    ("deepseek-r1", "deepseek"),
    ("llama-4-scout", "meta"),
]

agents = [
    "chef-agent", "simple-assistant", "dynamic-agent", "eval-agent", "network-agent",
    "support-agent", "billing-agent", "onboarding-agent", "search-agent", "analytics-agent",
    "moderation-agent", "translation-agent", "summarizer-agent", "scheduler-agent", "recommender-agent",
]

for day_offset in range(7):
    day = now - datetime.timedelta(days=day_offset)
    runs_per_day = random.randint(10, 25) if day_offset < 3 else random.randint(4, 12)

    for run in range(runs_per_day):
        ts = day - datetime.timedelta(
            hours=random.randint(0, 23),
            minutes=random.randint(0, 59),
            seconds=random.randint(0, 59),
        )
        ts_str = ts.strftime("%Y-%m-%dT%H:%M:%SZ")

        model, provider = random.choice(models)
        agent = random.choice(agents)
        trace_id = f"trace-multi-{day_offset}-{run}"
        span_id = f"span-multi-{day_offset}-{run}"

        input_tokens = random.randint(100, 2000)
        output_tokens = random.randint(50, 1500)
        cache_read = random.randint(0, input_tokens // 2)
        cache_write = random.randint(0, input_tokens // 4)

        for metric_name, value in [
            ("mastra_model_total_input_tokens", input_tokens),
            ("mastra_model_total_output_tokens", output_tokens),
            ("mastra_model_input_cache_read_tokens", cache_read),
            ("mastra_model_input_cache_write_tokens", cache_write),
        ]:
            metrics.append({
                "timestamp": ts_str,
                "name": metric_name,
                "value": value,
                "labels": {"model": model, "provider": provider},
                "entityType": "AGENT",
                "entityName": agent,
                "traceId": trace_id,
                "spanId": span_id + "-model",
            })

        duration = random.randint(300, 6000)
        status = "ok" if random.random() > 0.1 else "error"
        metrics.append({
            "timestamp": ts_str,
            "name": "mastra_agent_duration_ms",
            "value": duration,
            "labels": {"status": status},
            "entityType": "AGENT",
            "entityName": agent,
            "traceId": trace_id,
            "spanId": span_id + "-agent",
        })

batch_size = 50
total = len(metrics)
for i in range(0, total, batch_size):
    batch = metrics[i:i+batch_size]
    payload = json.dumps({"metrics": batch})
    subprocess.run(
        ["curl", "-s", "-X", "POST", "http://localhost:4111/debug/inject-metrics",
         "-H", "Content-Type: application/json", "-d", payload],
        capture_output=True, text=True,
    )

print(f"Multi-model metrics injected: {total}")
PYEOF

echo ""
echo "=== Done ==="
