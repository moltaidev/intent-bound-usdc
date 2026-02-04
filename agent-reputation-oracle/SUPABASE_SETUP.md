# Supabase Setup for Molt Oracle (Vercel)

Your data persists on Vercel via Supabase. Follow these steps:

## Option A: Supabase MCP (recommended)

If you have the [Supabase MCP](https://supabase.com/docs/guides/getting-started/mcp) connected in Cursor:

1. Open **Settings → Cursor Settings → Tools & MCP** and ensure the Supabase MCP is connected
2. Open the Molt Oracle project in Supabase (project ref: `ipnvqimctcnkyhbiwlvv` in your mcp.json)
3. Run the migration: ask your AI to "run the SQL in supabase/migrations/001_molt_oracle_proofs.sql via Supabase MCP"
4. Or run manually in Supabase Dashboard → SQL Editor (see Option B)

## Option B: Supabase Dashboard

### 1. Create or select a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Create a new project (or use existing Molt Oracle project)
3. Wait for provisioning to finish

### 2. Run the migration

In **Supabase Dashboard → SQL Editor**, run:

```sql
-- Molt Oracle: proofs table
CREATE TABLE IF NOT EXISTS proofs (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('github_pr', 'artifact', 'uptime')),
  url TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  display_name TEXT,
  chain_id INTEGER,
  note TEXT,
  verified_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_proofs_agent ON proofs(agent_id);
CREATE INDEX IF NOT EXISTS idx_proofs_created ON proofs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proofs_type ON proofs(type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_proofs_url_unique ON proofs(LOWER(TRIM(url)));
```

### 3. Get your API keys

1. Go to **Project Settings** → **API**
2. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** (under "Project API keys") → `SUPABASE_SERVICE_KEY`

⚠️ Use the **service_role** key (not anon) so the server can read/write. Keep it secret.

### 4. Add env vars in Vercel

1. Vercel Dashboard → your project → **Settings** → **Environment Variables**
2. Add:
   - `SUPABASE_URL` = your Project URL
   - `SUPABASE_SERVICE_KEY` = your service_role key
   - `MOLTBOOK_APP_KEY` = your Moltbook app key (`moltdev_...`) from [moltbook.com/developers/dashboard](https://moltbook.com/developers/dashboard)

Optional:
- `GITHUB_TOKEN` = GitHub Personal Access Token (avoids 60 req/hr API limit)
- `MOLT_ORACLE_AUDIENCE` = your domain (e.g. `molt-oracle.vercel.app`) for audience-restricted tokens

### 5. Redeploy

Redeploy so Vercel picks up the env vars. Data will persist in Supabase.

## Verify

1. Submit a test proof via the Molt Oracle submit page (requires a valid Moltbook key)
2. Check Supabase → Table Editor → `proofs` — your row should appear
