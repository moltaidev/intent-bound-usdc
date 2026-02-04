# The Full Power of OpenClaw (ClawdBot) — What It Does, Can Do, and Could Do

**Purpose:** Understand exactly what OpenClaw is and can do, so we can build something super innovative on top.

---

## 1. What OpenClaw Is (Exact)

- **One long-lived Gateway** owns all messaging surfaces and the control plane.
- **One embedded agent runtime** (derived from pi-mono) per agent: LLM + tools + workspace + sessions. Session management, discovery, and tool wiring are OpenClaw-owned (no pi-coding agent runtime, no `~/.pi`).
- **Channels:** WhatsApp (Baileys), Telegram (grammY), Discord, iMessage (imsg/BlueBubbles), Slack, Signal, Teams, WebChat, 50+ integrations. One Gateway per host; it is the only place that opens a WhatsApp session.
- **Clients:** macOS app, CLI (`openclaw`), web Control UI (default `http://<host>:18789/`), automations. All connect over **WebSocket** (default `127.0.0.1:18789`). Nodes (iOS/Android/headless) connect with `role: node` and expose device commands (canvas, camera, location, etc.).
- **Wire protocol:** JSON over WebSocket. First frame must be `connect`; then requests (`health`, `status`, `send`, `agent`, `system-presence`) and events (`tick`, `agent`, `presence`, `shutdown`). Token auth optional; pairing for new devices; idempotency keys for `send`/`agent`.

---

## 2. What It Does (Capabilities)

### 2.1 Agent runtime

- **Workspace:** Single directory per agent (`agents.defaults.workspace` or per-agent). Agent’s only `cwd` for tools and context.
- **Bootstrap files (injected):** `AGENTS.md` (instructions + memory), `SOUL.md` (persona, boundaries), `TOOLS.md` (tool notes), `BOOTSTRAP.md` (one-time ritual), `IDENTITY.md`, `USER.md`. Injected on first turn of a new session; large files trimmed.
- **Sessions:** Stored as JSONL under `~/.openclaw/agents/<agentId>/sessions/<sessionId>.jsonl`. Session ID stable; no Pi/Tau legacy folders.
- **Steering:** Queue modes `steer` (inject mid-run), `followup`, `collect`. Block streaming optional; chunking configurable.
- **Models:** Config as `provider/model`; multi-model lists; OpenRouter-style IDs supported.

### 2.2 Built-in tools

- **Execution:** Exec (shell), apply_patch (edits), read/write, Web Tools (fetch, search). Elevated mode for privileged ops; thinking levels; reactions.
- **Browser:** OpenClaw-managed browser, login support, Chrome extension. Profiles, local/remote.
- **Agent coordination:** Agent Send (message another agent), Sub-Agents (spawn background runs, isolated sessions, parallel work).
- **Automation:** Hooks (event-driven), Cron, Webhooks, Gmail PubSub, Polls, Auth Monitoring.
- **Media/nodes:** Image, audio, voice notes, camera, Talk Mode, Voice Wake, Location Command. Nodes expose canvas, camera, screen.record, location.get.
- **Skills:** Loaded from bundled, `~/.openclaw/skills`, workspace `skills/`; gated by metadata (bins, env, config). Slash commands; optional direct tool dispatch.

### 2.3 Multi-agent

- **Multiple agents = multiple “brains”:** Each agent has own workspace, `agentDir` (auth, config), session store. Auth not shared; bindings route inbound to `agentId`.
- **Bindings:** Deterministic, most-specific wins: peer (DM/group) → guildId/teamId → accountId → channel → default. Enables: one WhatsApp number with DM split (e.g. Alex vs Mia); two WhatsApps → two agents; WhatsApp = fast agent, Telegram = deep-work agent; one DM routed to Opus; family agent bound to one group with mention gating.
- **Per-agent sandbox & tools:** From v2026.1.6, each agent can have own sandbox (mode, scope, docker setupCommand) and tool allow/deny. So: personal agent no sandbox, family agent sandboxed + only `read`, etc.

### 2.4 Gateway APIs

- **WebSocket:** Full control plane (connect, agent, send, health, status, subscribe to events).
- **OpenResponses API:** HTTP, turn-based tool interactions.
- **Tools Invoke API:** HTTP invocation of agent tools (auth, policy, routing).
- **Control UI:** Vite + Lit, same port as WS; management and monitoring.
- **Canvas host:** Default 18793; serves agent-editable HTML / A2UI.

### 2.5 Plugins and extensibility

- **Plugins:** npm/archives; register agent tools (JSON-schema); required or optional; discovery, precedence, slots. Can ship skills via `openclaw.plugin.json`.
- **MCP / A2A:** Plugins can integrate MCP (tools/resources) and A2A (agent-to-agent). OpenClaw supports both; plugins can bridge.

### 2.6 Security and limits

- **Auth:** Gateway token; pairing for devices; optional TLS for remote.
- **Sandbox:** Per-agent Docker sandbox; `setupCommand` for container init; tools allow/deny per agent.
- **Skills:** Untrusted by default; env/apiKey inject into host (not sandbox). ClawHub supply-chain risk (malicious skills).
- **Invariants:** One Gateway = one Baileys session; handshake mandatory; no event replay.

---

## 3. What It Can Do (Summary)

- **Receive and send** messages across WhatsApp, Telegram, Discord, iMessage, Slack, WebChat, etc., from one Gateway.
- **Run an LLM agent** with a workspace, bootstrap files, and sessions; stream responses; steer or queue messages.
- **Execute code**, edit files, browse the web, run sub-agents, trigger hooks/cron/webhooks.
- **Route** multiple agents by channel/account/peer; isolate workspaces and auth; sandbox and restrict tools per agent.
- **Expose** control plane over WebSocket and HTTP (Tools Invoke, OpenResponses); serve Control UI and canvas.
- **Extend** via skills (ClawHub, local, workspace) and plugins (agent tools, MCP/A2A).

---

## 4. What It Could Do (Super Innovative If We Build It)

### 4.1 Leveraging the full stack

| Lever | What we have | Super innovative possibility |
|-------|----------------|-------------------------------|
| **Channels** | WhatsApp, Telegram, Discord, iMessage, WebChat | **“Set my mandate from my phone”** — user sets USDC rules via WhatsApp/Telegram; same mandate enforced for all agent payments from CLI/WebChat. One mandate, every surface. |
| **Multi-agent** | Isolated agents, bindings, per-agent sandbox/tools | **“Family agent can’t spend; work agent can, within mandate”** — different agents, different rules; one mandate skill reads agentId and applies the right policy. |
| **Sub-agents / Agent Send** | Spawn background runs, message other agents | **“Sub-agent pays for API call only if under parent’s mandate”** — mandate checked before any sub-agent payment; or Agent Send to a “treasury agent” that only pays when mandate allows. |
| **Gateway WS + HTTP** | Control plane, Tools Invoke API | **External apps** (e.g. BME, ClawTasks) **query mandate** via HTTP before creating escrow: “Is this agent allowed to lock 50 USDC?” Mandate as a **service** other products call. |
| **Hooks / Cron** | Event-driven, scheduled | **“Every payment attempt triggers a hook”** — hook calls mandate verifier; only if allowed, payment proceeds. Or cron: “Reset weekly cap every Monday.” |
| **Skills + plugins** | Teach agent how to use tools; plugins register tools | **One mandate skill** that (1) parses natural language → structured rule, (2) exposes a **tool** “check_mandate” or “request_payment” that backend/contract enforces. Other skills (e.g. USDC send) **call** that tool before doing the tx. |
| **Workspace (AGENTS.md, SOUL.md)** | Persistent context, persona | **Mandate in workspace** — e.g. “Current mandate: max 50 USDC/week for API” in AGENTS.md or a dedicated MANDATE.md; agent (and our skill) read it; single source of truth. |
| **Nodes (iOS/Android)** | Device identity, canvas, camera, location | **“Approve payment on my phone”** — high-value payment triggers a node prompt (e.g. iOS); user approves on device; mandate skill treats that as one-time exception or cap increase. |

### 4.2 The “ultimate” combo (if we build it)

- **One mandate skill** that: (1) lets user set rules in natural language (budget/cap/whitelist), (2) stores them (workspace file or backend), (3) exposes a **tool** “request_payment(amount, recipient, reason)” that **fails** if the request doesn’t fit the mandate.
- **Every other USDC flow** (another skill, BME, ClawTasks, x402) **calls** that tool (or an HTTP/contract check) before signing. So OpenClaw becomes the **single place** where “is this payment allowed?” is decided.
- **Multi-agent + channels:** Different people (or roles) get different agents; each agent has its own mandate. One Gateway, many agents, one mandate layer.
- **Gateway API:** External systems (escrow platforms, dashboards) **query** “mandate for agent X” or “can agent X spend Y to Z?” and get a yes/no. So the **power** is: OpenClaw is not only the UI for setting rules but the **authoritative** permission layer that the whole ecosystem can call.

### 4.3 One-sentence “full power” summary

**OpenClaw’s power:** One gateway that owns messaging (WhatsApp, Telegram, Discord, iMessage, …), runs one or many LLM agents with workspaces and tools, exposes control plane and tools over WS/HTTP, and extends via skills and plugins. **If we add a mandate layer** (one skill + backend/contract that enforces “only pay within my rules”), then OpenClaw becomes the **single place** where agent payment permission is defined and queried—from any channel, any agent, and any external product (BME, ClawTasks, x402)—making it the **permission layer** for agent-native finance.

---

*Refs: docs.openclaw.ai (architecture, agent, multi-agent, tools, skills, gateway, plugins).*
