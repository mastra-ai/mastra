#!/bin/bash

# Test which API versions are supported
echo "Testing Azure OpenAI API versions..."

source .env.azure

# Common Azure OpenAI API versions (from newest to oldest)
versions=(
  "2024-10-01-preview"
  "2024-08-01-preview"  
  "2024-06-01"
  "2024-05-01-preview"
  "2024-02-01"
  "2023-12-01-preview"
)

for version in "${versions[@]}"; do
  echo -n "Testing $version... "
  response=$(curl -s -w "\n%{http_code}" \
    "https://${AZURE_RESOURCE_NAME}.openai.azure.com/openai/deployments/gpt-4o-mini/chat/completions?api-version=$version" \
    -H "api-key: ${AZURE_API_KEY}" \
    -H "Content-Type: application/json" \
    -d '{
      "messages": [{"role": "user", "content": "test"}],
      "max_tokens": 5
    }' 2>&1)
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  
  if [ "$http_code" = "200" ]; then
    echo "✅ WORKS"
    echo "Response: $body"
    break
  elif echo "$body" | grep -q "API version.*not supported"; then
    echo "❌ Not supported"
  else
    echo "⚠️  Error (code: $http_code): $body"
  fi
done
