(function (global) {
  'use strict';

  function shortAddress(addr) {
    if (!addr || addr.length < 12) return addr || '';
    return addr.slice(0, 6) + '\u2026' + addr.slice(-5);
  }

  function agentDisplay(agent) {
    if (!agent) return '';
    return agent.agentId || agent.address || '';
  }

  function shortId(id) {
    if (!id || id.length <= 20) return id || '';
    return id.slice(0, 10) + '\u2026' + id.slice(-6);
  }

  function formatTimeAgo(iso) {
    if (!iso) return '';
    var str = String(iso).trim();
    if (str.indexOf(' ') >= 0 && str.indexOf('T') < 0) str = str.replace(' ', 'T');
    if (str.length <= 19 && !/Z|[+-]\d{2}/.test(str)) str += 'Z';
    var d = new Date(str);
    if (isNaN(d.getTime())) return str || '—';
    var now = new Date();
    var s = Math.floor((now - d) / 1000);
    if (s < 0) s = 0;
    if (s < 10) return 'just now';
    if (s < 60) return s + ' secs ago';
    if (s < 3600) { var m = Math.floor(s / 60); return m + (m === 1 ? ' min ago' : ' mins ago'); }
    if (s < 86400) { var h = Math.floor(s / 3600); return h + (h === 1 ? ' hour ago' : ' hours ago'); }
    if (s < 604800) { var day = Math.floor(s / 86400); return day + (day === 1 ? ' day ago' : ' days ago'); }
    if (s < 2592000) { var w = Math.floor(s / 604800); return w + (w === 1 ? ' week ago' : ' weeks ago'); }
    var mo = Math.floor(s / 2592000); return mo + (mo === 1 ? ' month ago' : ' months ago');
  }

  function badgeClass(name) {
    var map = { Builder: 'badge-builder', Trader: 'badge-trader', Reliable: 'badge-verified', Researcher: 'badge-researcher' };
    return 'badge ' + (map[name] || 'badge-verified');
  }

  function proofIconClass(type) {
    var map = { github_pr: 'merged', onchain_tx: 'onchain', uptime: 'uptime', artifact: 'artifact' };
    return 'audit-icon ' + (map[type] || 'merged');
  }

  function proofTypeLabel(type) {
    var map = { github_pr: 'GitHub PR', onchain_tx: 'Onchain tx', uptime: 'Uptime', artifact: 'Artifact' };
    return map[type] || type;
  }

  function proofTitle(type, url) {
    if (type === 'github_pr') {
      var m = (url || '').match(/github\.com\/([^/]+\/[^/]+)\/pull\/\d+/);
      return m ? 'PR merged — ' + m[1] : 'PR merged';
    }
    if (type === 'onchain_tx') return 'Onchain tx';
    if (type === 'artifact') return 'Artifact — Deploy';
    if (type === 'uptime') return 'Uptime heartbeat';
    return proofTypeLabel(type);
  }

  global.Oracle = {
    shortAddress: shortAddress,
    agentDisplay: agentDisplay,
    shortId: shortId,
    formatTimeAgo: formatTimeAgo,
    badgeClass: badgeClass,
    proofIconClass: proofIconClass,
    proofTitle: proofTitle,
    proofTypeLabel: proofTypeLabel
  };
})(typeof window !== 'undefined' ? window : this);
