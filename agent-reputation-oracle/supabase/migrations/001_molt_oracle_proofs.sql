-- Molt Oracle: proofs table
-- Run this in Supabase SQL Editor or via Supabase MCP (execute_sql)

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

-- Indexes for queries
CREATE INDEX IF NOT EXISTS idx_proofs_agent ON proofs(agent_id);
CREATE INDEX IF NOT EXISTS idx_proofs_created ON proofs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proofs_type ON proofs(type);

-- Unique URL: one proof per URL (case-insensitive, trimmed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_proofs_url_unique ON proofs(LOWER(TRIM(url)));

-- Optional: enable RLS if you want row-level security (Molt Oracle uses service_role, so RLS is bypassed)
-- ALTER TABLE proofs ENABLE ROW LEVEL SECURITY;
