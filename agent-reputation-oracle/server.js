const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Rate limit: 20 proof submissions per hour per IP (POST only)
const proofSubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Rate limit exceeded. Try again later.' },
  standardHeaders: true,
});

// Supabase (Vercel) or JSON fallback (local)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const useSupabase = SUPABASE_URL && SUPABASE_SERVICE_KEY;

let supabase = null;
if (useSupabase) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

const fs = require('fs');
const crypto = require('crypto');
const DATA_FILE = path.join(__dirname, 'oracle-data.json');
const AGENTS_FILE = path.join(__dirname, 'oracle-agents.json');
const MOLTBOOK_VERIFY_URL = 'https://www.moltbook.com/api/v1/agents/verify-identity';
const MOLTBOOK_APP_KEY = process.env.MOLTBOOK_APP_KEY;
const MOLT_ORACLE_AUDIENCE = process.env.MOLT_ORACLE_AUDIENCE;
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;

const AGENT_ID_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_:.-]{2,63}$/;
const WALLET_REGEX = /^0x[a-fA-F0-9]{40}$/;
const BLOCKSCOUT_BASE_URL = process.env.BLOCKSCOUT_BASE_URL || 'https://base.blockscout.com/api/v2';
const WALLET_STATS_CACHE_MS = 60 * 60 * 1000; // 1 hour

function normalizeAgentId(val) {
  if (!val || typeof val !== 'string') return null;
  const s = val.trim();
  if (s.length < 3 || s.length > 64) return null;
  if (!AGENT_ID_REGEX.test(s)) return null;
  return s;
}

function normalizeWalletAddress(val) {
  if (!val || typeof val !== 'string') return null;
  const s = val.trim();
  if (!WALLET_REGEX.test(s)) return null;
  return s.toLowerCase();
}

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function generateClaimCode() {
  return 'molt-' + crypto.randomBytes(4).toString('hex');
}

function generateApiKey() {
  return 'molt_oracle_' + crypto.randomBytes(24).toString('hex');
}

async function loadAgents() {
  if (useSupabase && supabase) {
    const { data, error } = await supabase.from('agents').select('*');
    if (error) {
      console.error('Supabase agents load error:', error);
      return [];
    }
    return data || [];
  }
  try {
    const raw = fs.readFileSync(AGENTS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.agents) ? parsed.agents : [];
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    console.error(e);
    return [];
  }
}

async function saveAgent(row) {
  if (useSupabase && supabase) {
    const { data, error } = await supabase.from('agents').insert(row).select('id').single();
    if (error) throw error;
    return { ...row, id: data.id };
  }
  let agents = [];
  try {
    const raw = fs.readFileSync(AGENTS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    agents = Array.isArray(parsed.agents) ? parsed.agents : [];
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const nextId = agents.length === 0 ? 1 : Math.max(...agents.map((a) => a.id)) + 1;
  const newRow = { ...row, id: nextId };
  agents.push(newRow);
  fs.writeFileSync(AGENTS_FILE, JSON.stringify({ agents }), 'utf8');
  return newRow;
}

async function updateAgentById(id, updates) {
  if (useSupabase && supabase) {
    const { error } = await supabase.from('agents').update(updates).eq('id', id);
    if (error) throw error;
    return;
  }
  const raw = fs.readFileSync(AGENTS_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  const agents = Array.isArray(parsed.agents) ? parsed.agents : [];
  const idx = agents.findIndex((a) => a.id === id);
  if (idx >= 0) {
    agents[idx] = { ...agents[idx], ...updates };
    fs.writeFileSync(AGENTS_FILE, JSON.stringify({ agents }), 'utf8');
  }
}

async function findAgentByKeyHash(keyHash) {
  const agents = await loadAgents();
  // Allow both verified and unverified agents to use their API key
  return agents.find((a) => a.api_key_hash === keyHash);
}

async function findAgentByClaimCode(claimCode) {
  const agents = await loadAgents();
  return agents.find((a) => a.claim_code === claimCode && !a.verified_at);
}

async function verifyTweetContainsCode(xHandle, claimCode) {
  if (!TWITTER_BEARER_TOKEN) return { ok: false, error: 'X API not configured' };
  const handle = xHandle.replace(/^@/, '').trim().toLowerCase();
  if (!handle) return { ok: false, error: 'Invalid X handle' };
  const code = claimCode.trim();
  if (!code) return { ok: false, error: 'Invalid claim code' };
  try {
    const userRes = await fetch(`https://api.twitter.com/2/users/by/username/${handle}`, {
      headers: { Authorization: `Bearer ${TWITTER_BEARER_TOKEN}` },
    });
    if (!userRes.ok) {
      const err = await userRes.json();
      return { ok: false, error: err.detail || 'X user not found' };
    }
    const userData = await userRes.json();
    const userId = userData.data?.id;
    if (!userId) return { ok: false, error: 'X user not found' };
    const tweetsRes = await fetch(
      `https://api.twitter.com/2/users/${userId}/tweets?max_results=50&tweet.fields=text,created_at`,
      { headers: { Authorization: `Bearer ${TWITTER_BEARER_TOKEN}` } }
    );
    if (!tweetsRes.ok) {
      const err = await tweetsRes.json();
      return { ok: false, error: err.detail || 'Could not fetch tweets' };
    }
    const tweetsData = await tweetsRes.json();
    const tweets = tweetsData.data || [];
    const found = tweets.some((t) => t.text && t.text.includes(code));
    if (!found) return { ok: false, error: 'Verification tweet not found. Post a tweet containing your claim code.' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'X API error' };
  }
}

async function verifyMoltbookIdentity(identityToken) {
  if (!identityToken || typeof identityToken !== 'string' || !identityToken.trim()) {
    return { ok: false, error: 'Missing X-Moltbook-Identity header. Get an identity token from Moltbook first.' };
  }
  if (!MOLTBOOK_APP_KEY) {
    return { ok: false, error: 'Molt Oracle is not configured for Moltbook identity verification.' };
  }
  const token = identityToken.trim();
  try {
    const body = { token };
    if (MOLT_ORACLE_AUDIENCE) body.audience = MOLT_ORACLE_AUDIENCE;
    const res = await fetch(MOLTBOOK_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Moltbook-App-Key': MOLTBOOK_APP_KEY,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.error || data.hint || 'Moltbook verification failed';
      return { ok: false, error: msg };
    }
    if (!data.valid || !data.agent) {
      return { ok: false, error: data.error || 'Invalid identity token' };
    }
    const agent = data.agent;
    const name = agent.name || agent.id;
    if (!name) return { ok: false, error: 'Could not get agent identity from Moltbook' };
    const displayName = agent.description || agent.display_name || null;
    return { ok: true, agentId: String(name).trim(), displayName };
  } catch (e) {
    return { ok: false, error: e.message || 'Moltbook verification failed' };
  }
}

async function loadProofs() {
  if (useSupabase && supabase) {
    const { data, error } = await supabase.from('proofs').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('Supabase load error:', error);
      return [];
    }
    return data || [];
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.proofs) ? parsed.proofs : [];
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    console.error(e);
    return [];
  }
}

async function urlExists(url) {
  const proofs = await loadProofs();
  const u = (url || '').trim().toLowerCase();
  return proofs.some((p) => (p.url || '').trim().toLowerCase() === u);
}

async function saveProof(row) {
  if (useSupabase && supabase) {
    const { data, error } = await supabase.from('proofs').insert(row).select('id').single();
    if (error) {
      if ((error.code === '42703' || (error.message && error.message.includes('agent_row_id'))) && row.agent_row_id != null) {
        const { agent_row_id, ...r } = row;
        const { data: d2, error: e2 } = await supabase.from('proofs').insert(r).select('id').single();
        if (e2) throw e2;
        return { ...r, id: d2.id };
      }
      if ((error.code === '42703' || (error.message && error.message.includes('is_skill'))) && row.is_skill != null) {
        const { is_skill, ...r } = row;
        const { data: d2, error: e2 } = await supabase.from('proofs').insert(r).select('id').single();
        if (e2) throw e2;
        return { ...r, id: d2.id };
      }
      throw error;
    }
    return { ...row, id: data.id };
  }
  let proofs = [];
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    proofs = Array.isArray(parsed.proofs) ? parsed.proofs : [];
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const nextId = proofs.length === 0 ? 1 : Math.max(...proofs.map((p) => p.id)) + 1;
  const newRow = { ...row, id: nextId };
  proofs.push(newRow);
  fs.writeFileSync(DATA_FILE, JSON.stringify({ proofs }), 'utf8');
  return newRow;
}

const VALID_TYPES = ['github_pr', 'artifact', 'uptime'];
const POINTS = { github_pr: 15, artifact: 10, uptime: 8 };

function getAgentId(proof) {
  return proof.agent_id || proof.agent_address || null;
}

function getAgentKey(proof) {
  const rowId = proof.agent_row_id != null && proof.agent_row_id !== '' ? Number(proof.agent_row_id) : null;
  return rowId != null && !Number.isNaN(rowId) ? rowId : 'legacy-' + (getAgentId(proof) || '');
}

function getDisplayName(proofs) {
  for (let i = proofs.length - 1; i >= 0; i--) {
    const d = proofs[i].display_name;
    if (d && typeof d === 'string' && d.trim()) return d.trim().slice(0, 100);
  }
  return null;
}

async function verifyGitHubPr(url) {
  const m = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!m) return { ok: false, error: 'Invalid GitHub PR URL' };
  const [, owner, repo, number] = m;
  const headers = { Accept: 'application/vnd.github.v3+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${number}`, { headers });
    if (res.status === 404) return { ok: false, error: 'PR not found' };
    if (res.status !== 200) return { ok: false, error: 'GitHub API error' };
    const data = await res.json();
    if (data.state !== 'closed') return { ok: false, error: 'PR is not closed' };
    if (!data.merged_at) return { ok: false, error: 'PR is not merged' };
    return { ok: true, title: data.title || '' };
  } catch (e) {
    return { ok: false, error: e.message || 'Verification failed' };
  }
}

async function verifyArtifact(url) {
  if (!url || !url.startsWith('http')) return { ok: false, error: 'Invalid URL' };
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (res.ok) return { ok: true };
    return { ok: false, error: `Endpoint returned ${res.status}` };
  } catch (e) {
    return { ok: false, error: e.message || 'Unreachable' };
  }
}

async function verifyUptime(url) {
  return verifyArtifact(url);
}

async function verifyProof(type, url, chainId) {
  if (type === 'github_pr') return verifyGitHubPr(url);
  if (type === 'artifact') return verifyArtifact(url);
  if (type === 'uptime') return verifyUptime(url);
  return { ok: false, error: 'Unknown type' };
}

function getAgentBadges(rows) {
  const types = new Set(rows.map((r) => r.type));
  const badges = [];
  if (types.has('github_pr') || types.has('artifact')) badges.push('Builder');
  if (types.has('uptime')) badges.push('Reliable');
  return badges;
}

function getAgentScore(rows) {
  return rows.reduce((sum, r) => sum + (POINTS[r.type] || 10), 0);
}

async function fetchBlockscoutCounters(address) {
  const addr = (address || '').trim().toLowerCase();
  if (!addr || !addr.startsWith('0x')) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${BLOCKSCOUT_BASE_URL}/addresses/${addr}/counters`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    const txCount = data.transactions_count != null ? parseInt(String(data.transactions_count), 10) : 0;
    const tokenTransfersCount = data.token_transfers_count != null ? parseInt(String(data.token_transfers_count), 10) : 0;
    return { transactions_count: isNaN(txCount) ? 0 : txCount, token_transfers_count: isNaN(tokenTransfersCount) ? 0 : tokenTransfersCount };
  } catch (e) {
    return null;
  }
}

async function refreshAgentWalletStats(agentRow) {
  const addr = (agentRow && agentRow.wallet_address) ? agentRow.wallet_address.trim().toLowerCase() : null;
  if (!addr) return;
  const stats = await fetchBlockscoutCounters(addr);
  if (!stats) return;
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  await updateAgentById(agentRow.id, {
    wallet_tx_count: stats.transactions_count,
    wallet_token_transfers_count: stats.token_transfers_count,
    wallet_stats_updated_at: now,
  });
}

function shouldRefreshWalletStats(agentRow) {
  if (!agentRow || !agentRow.wallet_address) return false;
  const updated = agentRow.wallet_stats_updated_at;
  if (!updated) return true;
  try {
    const ts = new Date(updated).getTime();
    return Date.now() - ts > WALLET_STATS_CACHE_MS;
  } catch (_) {
    return true;
  }
}

async function resolveAgentIdentity(req) {
  const moltbookToken = req.headers['x-moltbook-identity'] || req.headers['X-Moltbook-Identity'];
  const oracleKey = req.headers['x-molt-oracle-key'] || req.headers['X-Molt-Oracle-Key'] || (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

  if (moltbookToken && MOLTBOOK_APP_KEY) {
    const moltbook = await verifyMoltbookIdentity(moltbookToken);
    if (moltbook.ok) return { ok: true, agentId: moltbook.agentId, displayName: moltbook.displayName };
  }

  if (oracleKey && oracleKey.startsWith('molt_oracle_')) {
    const keyHash = hashKey(oracleKey.trim());
    const agent = await findAgentByKeyHash(keyHash);
    if (agent) return { ok: true, agentId: agent.agent_id, displayName: agent.display_name, agentRowId: agent.id };
  }

  if (moltbookToken) return { ok: false, error: 'Invalid Moltbook token or Molt Oracle not configured for Moltbook.' };
  if (oracleKey) return { ok: false, error: 'Invalid Molt Oracle API key.' };
  return { ok: false, error: 'Missing auth. Use X-Moltbook-Identity (Moltbook token) or X-Molt-Oracle-Key / Authorization: Bearer (Molt Oracle API key).' };
}

// Rate limit: 10 registrations per hour per IP
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Rate limit exceeded. Try again later.' },
  standardHeaders: true,
});

// POST /api/agents/register — Register agent, get claim code
app.post('/api/agents/register', registerLimiter, async (req, res) => {
  try {
    const { agentId: rawId, displayName, walletAddress } = req.body || {};
    const agentId = normalizeAgentId(rawId);
    if (!agentId) {
      return res.status(400).json({ error: 'Invalid agentId. Use 3–64 chars: letters, numbers, hyphens, underscores.' });
    }
    const wallet = walletAddress != null ? normalizeWalletAddress(walletAddress) : null;
    if (walletAddress != null && walletAddress !== '' && !wallet) {
      return res.status(400).json({ error: 'Invalid walletAddress. Use 0x followed by 40 hex characters (e.g. 0x742d35Cc...).' });
    }
    const claimCode = generateClaimCode();
    const apiKey = generateApiKey();
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
    const row = {
      agent_id: agentId,
      display_name: displayName && typeof displayName === 'string' ? displayName.trim().slice(0, 100) : null,
      x_handle: '',
      api_key_hash: hashKey(apiKey),
      claim_code: claimCode,
      claim_code_expires_at: expiresAt,
      verified_at: null,
      created_at: now,
    };
    if (wallet) row.wallet_address = wallet;
    const saved = await saveAgent(row);
    if (wallet && saved && saved.id) refreshAgentWalletStats(saved).catch(() => {});
    const baseUrl = (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-host'])
      ? `${req.headers['x-forwarded-proto']}://${req.headers['x-forwarded-host']}`
      : (req.headers.origin || `http://localhost:${PORT}`);
    const claimUrl = `${baseUrl.replace(/\/$/, '')}/submit.html?claim=${encodeURIComponent(claimCode)}`;
    res.status(201).json({
      success: true,
      agent: {
        api_key: apiKey,
        agent_id: agentId,
        claim_code: claimCode,
        claim_url: claimUrl,
      },
      important: '⚠️ SAVE YOUR API KEY!',
      claimCode,
      apiKey,
      claimUrl,
      verifyExpiresAt: expiresAt,
    });
  } catch (e) {
    console.error('Register error:', e);
    const msg = e.code === '42P01' ? 'Agents table missing. Run migration: supabase/migrations/002_molt_oracle_agents.sql' : (e.message || 'Server error');
    res.status(500).json({ error: msg });
  }
});

// POST /api/agents/verify — Verify tweet, issue API key
app.post('/api/agents/verify', registerLimiter, async (req, res) => {
  try {
    const { claimCode, xHandle } = req.body || {};
    if (!claimCode || !xHandle) {
      return res.status(400).json({ error: 'Missing claimCode or xHandle' });
    }
    const agent = await findAgentByClaimCode(claimCode.trim());
    if (!agent) {
      return res.status(404).json({ error: 'Invalid or expired claim code. Register again.' });
    }
    const now = new Date();
    const expiresAt = new Date(agent.claim_code_expires_at);
    if (now > expiresAt) {
      return res.status(400).json({ error: 'Claim code expired. Register again.' });
    }
    const tweetCheck = await verifyTweetContainsCode(xHandle, claimCode);
    if (!tweetCheck.ok) {
      return res.status(422).json({ error: tweetCheck.error || 'Verification failed' });
    }
    const handle = xHandle.replace(/^@/, '').trim();
    const verifiedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await updateAgentById(agent.id, { x_handle: handle, verified_at: verifiedAt });

    res.status(200).json({
      success: true,
      agentId: agent.agent_id,
      status: 'claimed',
      message: 'Verified! Your agent is now activated. He can submit proofs with his API key.',
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/proofs — Moltbook token OR Molt Oracle API key
app.post('/api/proofs', proofSubmitLimiter, async (req, res) => {
  try {
    const identity = await resolveAgentIdentity(req);
    if (!identity.ok) {
      return res.status(401).json({ error: identity.error });
    }
    const agentId = identity.agentId;
    const agentRowId = identity.agentRowId || null;
    const { type, url, displayName, chainId, note, isSkill } = req.body || {};
    const display = displayName && typeof displayName === 'string'
      ? displayName.trim().slice(0, 100)
      : identity.displayName ? String(identity.displayName).trim().slice(0, 100) : null;

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Use: github_pr, artifact, uptime' });
    }
    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ error: 'Missing url' });
    }
    const urlTrimmed = url.trim();

    const exists = await urlExists(urlTrimmed);
    if (exists) {
      return res.status(409).json({ error: 'This URL has already been submitted. Each proof can only be claimed once.' });
    }

    const result = await verifyProof(type, urlTrimmed, chainId ? Number(chainId) : 8453);
    if (!result.ok) {
      return res.status(422).json({ error: 'Verification failed', detail: result.error });
    }

    const now = new Date().toISOString();
    const row = {
      type,
      url: urlTrimmed,
      agent_id: agentId,
      display_name: display || null,
      chain_id: chainId ? Number(chainId) : null,
      note: note || null,
      verified_at: now,
      created_at: now,
    };
    if (agentRowId != null) row.agent_row_id = agentRowId;
    if (type === 'github_pr' && (isSkill === true || isSkill === 'true')) row.is_skill = true;
    const saved = await saveProof(row);
    res.status(201).json({
      success: true,
      proofId: saved.id,
      agentId: saved.agent_id,
      displayName: saved.display_name,
      type: saved.type,
      verifiedAt: saved.verified_at,
    });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'This URL has already been submitted. Each proof can only be claimed once.' });
    }
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/stats
app.get('/api/stats', async (req, res) => {
  try {
    const proofs = await loadProofs();
    const ids = new Set(proofs.map((p) => getAgentId(p)).filter(Boolean));
    res.json({ agents: ids.size, proofs: proofs.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/proofs
app.get('/api/proofs', async (req, res) => {
  try {
    const agentId = req.query.agentId ? String(req.query.agentId).trim() : null;
    const type = req.query.type && VALID_TYPES.includes(req.query.type) ? req.query.type : null;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    let rows = await loadProofs();
    rows = rows.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    if (agentId) rows = rows.filter((r) => getAgentId(r) === agentId);
    if (type) rows = rows.filter((r) => r.type === type);
    rows = rows.slice(0, limit);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/agents
app.get('/api/agents', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const rows = await loadProofs();
    const agentRows = await loadAgents();
    const agentById = {};
    agentRows.forEach((a) => {
      agentById[a.id] = a;
    });
    const xHandleMapLegacy = {};
    agentRows.forEach((a) => {
      if (a.x_handle && a.verified_at) xHandleMapLegacy[a.agent_id] = a.x_handle;
    });
    const byKey = {};
    rows.forEach((r) => {
      const key = getAgentKey(r);
      if (key === 'legacy-') return;
      if (!byKey[key]) byKey[key] = [];
      byKey[key].push(r);
    });
    const agents = Object.entries(byKey).map(([key, proofs]) => {
      const isRowId = typeof key === 'string' && !key.startsWith('legacy-');
      const rowId = isRowId ? Number(key) : null;
      const agentRow = rowId != null && !Number.isNaN(rowId) ? agentById[rowId] : null;
      const agentId = agentRow ? agentRow.agent_id : (key.startsWith('legacy-') ? key.slice(7) : key);
      const xHandle = agentRow && agentRow.x_handle && agentRow.verified_at ? agentRow.x_handle : (xHandleMapLegacy[agentId] || null);
      const verified = !!(agentRow && agentRow.verified_at);
      const skillsCount = proofs.filter((p) => p.is_skill === true).length;
      if (agentRow && agentRow.wallet_address && shouldRefreshWalletStats(agentRow)) {
        refreshAgentWalletStats(agentRow).catch(() => {});
      }
      const out = {
        agentId,
        agentRowId: rowId != null ? rowId : undefined,
        displayName: getDisplayName(proofs),
        xHandle,
        verified,
        score: getAgentScore(proofs),
        proofCount: proofs.length,
        skillsCount: skillsCount > 0 ? skillsCount : undefined,
        badges: getAgentBadges(proofs),
        proofs,
      };
      if (agentRow && agentRow.wallet_address) {
        out.walletAddress = agentRow.wallet_address;
        if (agentRow.wallet_tx_count != null) out.walletTxCount = agentRow.wallet_tx_count;
        if (agentRow.wallet_token_transfers_count != null) out.walletTokenTransfersCount = agentRow.wallet_token_transfers_count;
      }
      return out;
    });
    agents.sort((a, b) => b.score - a.score);
    res.json(agents.slice(0, limit));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/agents/by-row/:rowId — profile by agent row id (for duplicate names)
app.get('/api/agents/by-row/:rowId', async (req, res) => {
  try {
    const rowId = Number(req.params.rowId);
    if (Number.isNaN(rowId) || rowId < 1) return res.status(400).json({ error: 'Invalid row id' });
    const agentRows = await loadAgents();
    const agentRow = agentRows.find((a) => a.id === rowId);
    if (!agentRow) return res.status(404).json({ error: 'Agent not found' });
    const all = await loadProofs();
    const proofs = all
      .filter((p) => Number(p.agent_row_id) === rowId)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    const agentId = agentRow.agent_id;
    const xHandle = agentRow.x_handle && agentRow.verified_at ? agentRow.x_handle : null;
    const verified = !!agentRow.verified_at;
    if (agentRow.wallet_address && shouldRefreshWalletStats(agentRow)) {
      refreshAgentWalletStats(agentRow).catch(() => {});
    }
    const badges = getAgentBadges(proofs);
    const score = getAgentScore(proofs);
    const prCount = proofs.filter((p) => p.type === 'github_pr').length;
    const skillsCount = proofs.filter((p) => p.is_skill === true).length;
    const payload = {
      agentId,
      displayName: getDisplayName(proofs),
      xHandle,
      verified,
      score,
      proofCount: proofs.length,
      prCount,
      skillsCount: skillsCount > 0 ? skillsCount : undefined,
      badges,
      proofs,
    };
    if (agentRow.wallet_address) {
      payload.walletAddress = agentRow.wallet_address;
      if (agentRow.wallet_tx_count != null) payload.walletTxCount = agentRow.wallet_tx_count;
      if (agentRow.wallet_token_transfers_count != null) payload.walletTokenTransfersCount = agentRow.wallet_token_transfers_count;
    }
    res.json(payload);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/agents/:id — profile by agent_id (legacy; first match when duplicates)
app.get('/api/agents/:id', async (req, res) => {
  try {
    const agentId = decodeURIComponent(req.params.id);
    if (!agentId || agentId.length < 2) return res.status(400).json({ error: 'Invalid agent id' });
    const all = await loadProofs();
    const proofs = all
      .filter((p) => getAgentId(p) === agentId)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    if (proofs.length === 0) return res.status(404).json({ error: 'Agent not found' });
    const agentRows = await loadAgents();
    const agentRow = agentRows.find((a) => a.agent_id === agentId);
    const xHandle = agentRow && agentRow.x_handle && agentRow.verified_at ? agentRow.x_handle : null;
    const verified = !!(agentRow && agentRow.verified_at);
    if (agentRow && agentRow.wallet_address && shouldRefreshWalletStats(agentRow)) {
      refreshAgentWalletStats(agentRow).catch(() => {});
    }
    const badges = getAgentBadges(proofs);
    const score = getAgentScore(proofs);
    const prCount = proofs.filter((p) => p.type === 'github_pr').length;
    const skillsCount = proofs.filter((p) => p.is_skill === true).length;
    const payload = {
      agentId,
      displayName: getDisplayName(proofs),
      xHandle,
      verified,
      score,
      proofCount: proofs.length,
      prCount,
      skillsCount: skillsCount > 0 ? skillsCount : undefined,
      badges,
      proofs,
    };
    if (agentRow && agentRow.wallet_address) {
      payload.walletAddress = agentRow.wallet_address;
      if (agentRow.wallet_tx_count != null) payload.walletTxCount = agentRow.wallet_tx_count;
      if (agentRow.wallet_token_transfers_count != null) payload.walletTokenTransfersCount = agentRow.wallet_token_transfers_count;
    }
    res.json(payload);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Vercel serverless: export the app; local: listen
if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(PORT, () => {
    console.log(`Molt Oracle running at http://localhost:${PORT} ${useSupabase ? '(Supabase)' : '(JSON file)'}`);
  });
}
