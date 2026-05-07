import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SessionMeta {
  sessionId: string;
  firstPrompt: string;
  startTime: string;
  durationMinutes: number;
  userMessageCount: number;
  assistantMessageCount: number;
}

const claudeDir = path.join(os.homedir(), '.claude');

// Build a map of sessionId -> display text from history.jsonl
function loadHistoryMap(): Map<string, string> {
  const map = new Map<string, string>();
  const histFile = path.join(claudeDir, 'history.jsonl');
  if (!fs.existsSync(histFile)) return map;
  const lines = fs.readFileSync(histFile, 'utf8').split('\n').filter(Boolean);
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.sessionId && obj.display) {
        // Keep the latest entry for each session (last write wins)
        map.set(obj.sessionId, obj.display);
      }
    } catch { /* skip malformed lines */ }
  }
  return map;
}

function readFirstPromptFromJsonl(filePath: string): string {
  try {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.type === 'user' && obj.message?.role === 'user') {
          const parts = obj.message.content;
          if (Array.isArray(parts)) {
            const text = parts.find((p: { type: string; text?: string }) => p.type === 'text');
            if (text?.text) return text.text.slice(0, 120);
          } else if (typeof parts === 'string') {
            return parts.slice(0, 120);
          }
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return '';
}

export function readAllSessions(): SessionMeta[] {
  const metaDir = path.join(claudeDir, 'usage-data', 'session-meta');
  const historyMap = loadHistoryMap();
  const knownIds = new Set<string>();
  const results: SessionMeta[] = [];

  // 1. Load completed sessions from session-meta
  if (fs.existsSync(metaDir)) {
    const files = fs.readdirSync(metaDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(metaDir, file), 'utf8');
        const meta = JSON.parse(raw);
        const sessionId: string = meta.session_id ?? file.replace('.json', '');
        knownIds.add(sessionId);
        const firstPrompt: string = historyMap.get(sessionId) ?? meta.first_prompt ?? '';
        results.push({
          sessionId,
          firstPrompt: firstPrompt.slice(0, 120),
          startTime: meta.start_time ?? '',
          durationMinutes: meta.duration_minutes ?? 0,
          userMessageCount: meta.user_message_count ?? 0,
          assistantMessageCount: meta.assistant_message_count ?? 0,
        });
      } catch { /* skip malformed files */ }
    }
  }

  // 2. Scan JSONL files for in-progress sessions not yet in session-meta
  const projDir = path.join(claudeDir, 'projects', 'C--Users-I327394');
  if (fs.existsSync(projDir)) {
    const jsonlFiles = fs.readdirSync(projDir).filter(
      f => f.endsWith('.jsonl') && !knownIds.has(f.replace('.jsonl', ''))
    );
    for (const file of jsonlFiles) {
      const sessionId = file.replace('.jsonl', '');
      const filePath = path.join(projDir, file);
      try {
        const stat = fs.statSync(filePath);
        const mtime = stat.mtime.toISOString();
        const firstPrompt = historyMap.get(sessionId) ?? readFirstPromptFromJsonl(filePath);
        results.push({
          sessionId,
          firstPrompt: firstPrompt.slice(0, 120),
          startTime: mtime,
          durationMinutes: 0,
          userMessageCount: 0,
          assistantMessageCount: 0,
        });
      } catch { /* skip */ }
    }
  }

  // Sort newest first
  results.sort((a, b) => {
    if (!a.startTime) return 1;
    if (!b.startTime) return -1;
    return b.startTime.localeCompare(a.startTime);
  });
  return results;
}

export function getSessionMetaDir(): string {
  return path.join(claudeDir, 'usage-data', 'session-meta');
}
