-- Allow duplicate agent names; tie proofs to agent row for leaderboard
-- Run in Supabase SQL Editor

-- Drop unique constraint on agent_id so multiple agents can share a name
ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_agent_id_key;

-- Tie proofs to specific agent row (for duplicate names)
ALTER TABLE proofs ADD COLUMN IF NOT EXISTS agent_row_id BIGINT REFERENCES agents(id) NULL;
CREATE INDEX IF NOT EXISTS idx_proofs_agent_row_id ON proofs(agent_row_id);
