-- Add is_skill flag for proofs that contribute agent skills (e.g. SKILL.md PRs)
-- Run in Supabase SQL Editor

ALTER TABLE proofs ADD COLUMN IF NOT EXISTS is_skill BOOLEAN DEFAULT false;
