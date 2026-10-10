#!/bin/sh
set -eu

npm install --workspaces=false

if [ ! -f .env ]; then
  cp .env.example .env
fi
