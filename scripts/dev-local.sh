#!/usr/bin/env bash
set -euo pipefail

PORT=27017
SSH_PID=""

cleanup() {
  [[ -n "$SSH_PID" ]] && kill "$SSH_PID" 2>/dev/null
}
trap cleanup EXIT

ssh -f -N -L ${PORT}:127.0.0.1:${PORT} ovh-server
SSH_PID=$(pgrep -fn "ssh.*-L.*${PORT}:127.0.0.1:${PORT}.*ovh-server")

echo "Tunnel SSH actif (PID $SSH_PID)"
nodemon