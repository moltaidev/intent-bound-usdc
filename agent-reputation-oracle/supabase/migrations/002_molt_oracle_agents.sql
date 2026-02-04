-- Molt Oracle: agents table (X verification)
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS agents (
  id BIGSERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL UNIQUE,
  display_name TEXT,
  x_handle TEXT NOT NULL,
  api_key_hash TEXT,
  claim_code TEXT NOT NULL,
  claim_code_expires_at TEXT NOT NULL,
  verified_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agents_agent_id ON agents(agent_id);
CREATE INDEX IF NOT EXISTS idx_agents_api_key_hash ON agents(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_agents_claim_code ON agents(claim_code);
