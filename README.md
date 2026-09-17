# Hostkey MCP Server

MCP server for [Hostkey](https://hostkey.com/) (**.com** portal, InvAPI `invapi.hostkey.com`).
Runs locally over stdio — Cursor, VS Code, and other MCP clients.

| | |
|---|---|
| **Endpoint** | `https://invapi.hostkey.com` (hardcoded) |
| **Auth** | `HOSTKEY_API_KEY` |
| **Tools** | 132 typed tools + `call_api_raw` |

Gives the model access to your Hostkey account: servers, catalog and ordering, power, OS reinstall,
network, DNS, snapshots, IPMI/console, ISO, S3, Remote Hands, billing, and API keys.

For the **.ru** portal use the separate package `hostkey-mcp-server-ru`.

## 1. Get an API key

[InvAPI](https://invapi.hostkey.com) → API keys → create a key.

Prefer a dedicated key for MCP. Per-server keys limit access to one server.
DNS writes need the `pdns/edit` permission.

## 2. Install

### Cursor

[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=hostkey-mcp-server&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImhvc3RrZXktbWNwLXNlcnZlciJdLCJlbnYiOnsiSE9TVEtFWV9BUElfS0VZIjoiWU9VUl9BUElfS0VZIn19)

Click the button, replace `YOUR_API_KEY` with your InvAPI key, then confirm.

Or add to `.cursor/mcp.json` manually:

```json
{
  "mcpServers": {
    "hostkey-mcp-server": {
      "command": "npx",
      "args": ["-y", "hostkey-mcp-server"],
      "env": {
        "HOSTKEY_API_KEY": "your-api-key"
      }
    }
  }
}
```

### VS Code

`.vscode/mcp.json`:

```json
{
  "mcp.servers": {
    "hostkey-mcp-server": {
      "command": "npx",
      "args": ["-y", "hostkey-mcp-server"],
      "env": {
        "HOSTKEY_API_KEY": "your-api-key"
      }
    }
  }
}
```

Optional: `HOSTKEY_TOKEN_TTL`, `HOSTKEY_HTTP_TIMEOUT`, `HOSTKEY_ALLOW_DESTRUCTIVE`
(see `.env.example`).

From source (Node.js ≥ 20): `npm install && npm run build`.

## 3. Confirming dangerous operations

Every write call needs `confirm=true`. Without it, nothing changes.

Also:

- `order_server` defaults to `dry_run` — a real order only after explicit consent;
- OS reinstall, PXE, and service cancellation require `HOSTKEY_ALLOW_DESTRUCTIVE=1`;
- passwords and tokens are masked in responses.

Long jobs (deploy, reinstall) return a callback key — poll with `check_task`.

## 4. Tools

Groups (full list via `tools/list`):

| Group | Examples |
|---|---|
| Servers | `get_servers`, `get_server`, `get_power_status` |
| Catalog | `list_presets`, `list_os`, `list_traffic_plans` |
| Power & order | `power_on`, `power_off`, `order_server`, `reinstall_server` |
| PXE | `create_reinstall_task` → … → `clear_pxe_config` |
| Network / DNS | ports, PTR, zones and records |
| Snapshots, ISO, S3 | VM snapshots, images, buckets |
| Remote Hands | duty-shift tickets (`request_rh_*`, `rhr_*`) |
| Billing | invoices, payments, contacts |
| Misc | `check_task`, `call_api_raw` |

## Prompts

| Prompt | Purpose |
|---|---|
| `order_server_prompt` | guided server order |
| `reinstall_server_prompt` | OS reinstall |
| `troubleshoot_server_prompt` | diagnostics |

Or just ask: “list my servers” / “order a VPS in NL”.
