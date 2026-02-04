-- Molt Oracle: optional wallet + Blockscout cache for on-chain activity
-- Run in Supabase SQL Editor

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS wallet_address TEXT,
  ADD COLUMN IF NOT EXISTS wallet_tx_count INTEGER,
  ADD COLUMN IF NOT EXISTS wallet_token_transfers_count INTEGER,
  ADD COLUMN IF NOT EXISTS wallet_stats_updated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_agents_wallet ON agents(wallet_address) WHERE wallet_address IS NOT NULL;
