'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const claudeDir = path.join(os.homedir(), '.claude');

function loadHistoryMap() {
  const map = new Map();
  const histFile = path.join(claudeDir, 'history.jsonl');
  if (!fs.existsSync(histFile)) return map;
  const lines = fs.readFileSync(histFile, 'utf8').split('\n').filter(Boolean);
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.sessionId && obj.display) map.set(obj.sessionId, obj.display);
    } catch {}
  }
  return map;
}

// Read first user message from a JSONL conversation file (fast: stop after first user message)
function readFirstPromptFromJsonl(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.type === 'user' && obj.message && obj.message.role === 'user') {
          const parts = obj.message.content;
          if (Array.isArray(parts)) {
            const text = parts.find(p => p.type === 'text');
            if (text && text.text) return text.text.slice(0, 120);
          } else if (typeof parts === 'string') {
            return parts.slice(0, 120);
          }
        }
      } catch {}
    }
  } catch {}
  return '';
}

function readAllSessions() {
  const metaDir = path.join(claudeDir, 'usage-data', 'session-meta');
  const historyMap = loadHistoryMap();
  const knownIds = new Set();
  const results = [];

  // 1. Load completed sessions from session-meta
  if (fs.existsSync(metaDir)) {
    const files = fs.readdirSync(metaDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(metaDir, file), 'utf8');
        const meta = JSON.parse(raw);
        const sessionId = meta.session_id || file.replace('.json', '');
        knownIds.add(sessionId);
        const firstPrompt = historyMap.get(sessionId) || meta.first_prompt || '';
        results.push({
          sessionId,
          firstPrompt: firstPrompt.slice(0, 120),
          startTime: meta.start_time || '',
          sortKey: meta.start_time || '',
          durationMinutes: meta.duration_minutes || 0,
          userMessageCount: meta.user_message_count || 0,
          assistantMessageCount: meta.assistant_message_count || 0,
          isActive: false,
        });
      } catch {}
    }
  }

  // 2. Scan JSONL files for in-progress sessions not in session-meta
  // Only scan top-level JSONL files (not subdirectories = subagent sessions)
  const projectDirs = [
    path.join(claudeDir, 'projects', 'C--Users-I327394'),
  ];
  for (const projDir of projectDirs) {
    if (!fs.existsSync(projDir)) continue;
    const jsonlFiles = fs.readdirSync(projDir)
      .filter(f => f.endsWith('.jsonl') && !knownIds.has(f.replace('.jsonl', '')));
    for (const file of jsonlFiles) {
      const sessionId = file.replace('.jsonl', '');
      if (knownIds.has(sessionId)) continue;
      const filePath = path.join(projDir, file);
      try {
        const stat = fs.statSync(filePath);
        const mtime = stat.mtime.toISOString();
        const firstPrompt = historyMap.get(sessionId) || readFirstPromptFromJsonl(filePath);
        results.push({
          sessionId,
          firstPrompt: firstPrompt.slice(0, 120),
          startTime: mtime,
          sortKey: mtime,
          durationMinutes: 0,
          userMessageCount: 0,
          assistantMessageCount: 0,
          isActive: true,
        });
      } catch {}
    }
  }

  // Sort by sortKey descending (newest first)
  results.sort((a, b) => {
    if (!a.sortKey && !b.sortKey) return 0;
    if (!a.sortKey) return 1;
    if (!b.sortKey) return -1;
    return b.sortKey.localeCompare(a.sortKey);
  });

  return results;
}

function getSessionMetaDir() {
  return path.join(claudeDir, 'usage-data', 'session-meta');
}

function getProjectsDir() {
  return path.join(claudeDir, 'projects', 'C--Users-I327394');
}

module.exports = { readAllSessions, getSessionMetaDir, getProjectsDir };
