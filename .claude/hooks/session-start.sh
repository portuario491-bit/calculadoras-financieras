#!/bin/bash
set -euo pipefail

# Only needed in Claude Code on the web (remote) sessions.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# --- Node.js 24+ (required by the Hostinger MCP connector) ---
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
fi

node_ok=false
if command -v node >/dev/null 2>&1; then
  node_major="$(node -e 'console.log(process.versions.node.split(".")[0])' 2>/dev/null || echo 0)"
  if [ "${node_major:-0}" -ge 24 ] 2>/dev/null; then
    node_ok=true
  fi
fi

if [ "$node_ok" != "true" ]; then
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    # shellcheck disable=SC1091
    . "$NVM_DIR/nvm.sh"
  fi
  nvm install 24
fi
nvm use 24 >/dev/null

NODE_BIN_DIR="$(dirname "$(command -v node)")"

# --- Hostinger connector package ---
if ! "$NODE_BIN_DIR/npm" ls -g hostinger-api-mcp >/dev/null 2>&1; then
  "$NODE_BIN_DIR/npm" install -g hostinger-api-mcp
fi

HOSTING_BIN="$NODE_BIN_DIR/hostinger-hosting-mcp"

# --- Register the MCP server (requires HOSTINGER_API_TOKEN as an env var,
#     configured at the environment level -- never committed to the repo) ---
if [ -z "${HOSTINGER_API_TOKEN:-}" ]; then
  echo "[hostinger] HOSTINGER_API_TOKEN no está definido en el entorno; se omite el registro del conector de Hostinger." >&2
  exit 0
fi

if command -v claude >/dev/null 2>&1; then
  claude mcp remove hostinger-hosting --scope user >/dev/null 2>&1 || true
  claude mcp add \
    --env HOSTINGER_API_TOKEN="$HOSTINGER_API_TOKEN" \
    --env NODE_USE_ENV_PROXY=1 \
    --transport stdio hostinger-hosting --scope user -- "$HOSTING_BIN" >/dev/null
  echo "[hostinger] Conector de Hostinger registrado (hostinger-hosting)."
fi
