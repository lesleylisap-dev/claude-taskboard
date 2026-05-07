import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

export interface TaskSession {
  sessionId: string;
  label?: string;
  addedAt: string;
}

export interface Task {
  id: string;
  name: string;
  color: string;
  status: 'active' | 'archived';
  createdAt: string;
  sessions: TaskSession[];
  headerContent?: string;
}

export interface TaskBoard {
  tasks: Task[];
}

const boardFile = path.join(os.homedir(), '.claude', 'taskboard.json');

const DEFAULT_COLORS = [
  '#4CAF50', '#2196F3', '#FF9800', '#E91E63',
  '#9C27B0', '#00BCD4', '#FF5722', '#607D8B',
];

export function loadBoard(): TaskBoard {
  if (!fs.existsSync(boardFile)) return { tasks: [] };
  try {
    return JSON.parse(fs.readFileSync(boardFile, 'utf8')) as TaskBoard;
  } catch {
    return { tasks: [] };
  }
}

export function saveBoard(board: TaskBoard): void {
  fs.writeFileSync(boardFile, JSON.stringify(board, null, 2), 'utf8');
}

export function createTask(name: string, color?: string): Task {
  const board = loadBoard();
  const idx = board.tasks.length % DEFAULT_COLORS.length;
  const task: Task = {
    id: crypto.randomUUID(),
    name,
    color: color ?? DEFAULT_COLORS[idx],
    status: 'active',
    createdAt: new Date().toISOString(),
    sessions: [],
  };
  board.tasks.unshift(task);
  saveBoard(board);
  return task;
}

export function assignSession(taskId: string, sessionId: string, label?: string): void {
  const board = loadBoard();
  const task = board.tasks.find(t => t.id === taskId);
  if (!task) return;
  // Avoid duplicates
  if (task.sessions.some(s => s.sessionId === sessionId)) return;
  task.sessions.unshift({ sessionId, label, addedAt: new Date().toISOString() });
  saveBoard(board);
}

export function removeSession(taskId: string, sessionId: string): void {
  const board = loadBoard();
  const task = board.tasks.find(t => t.id === taskId);
  if (!task) return;
  task.sessions = task.sessions.filter(s => s.sessionId !== sessionId);
  saveBoard(board);
}

export function archiveTask(taskId: string): void {
  const board = loadBoard();
  const task = board.tasks.find(t => t.id === taskId);
  if (task) { task.status = 'archived'; saveBoard(board); }
}

export function unarchiveTask(taskId: string): void {
  const board = loadBoard();
  const task = board.tasks.find(t => t.id === taskId);
  if (task) { task.status = 'active'; saveBoard(board); }
}

export function deleteTask(taskId: string): void {
  const board = loadBoard();
  board.tasks = board.tasks.filter(t => t.id !== taskId);
  saveBoard(board);
}

export function renameSession(taskId: string, sessionId: string, label: string): void {
  const board = loadBoard();
  const task = board.tasks.find(t => t.id === taskId);
  if (!task) return;
  const s = task.sessions.find(x => x.sessionId === sessionId);
  if (s) { s.label = label; saveBoard(board); }
}

export function updateTaskHeader(taskId: string, headerContent: string): void {
  const board = loadBoard();
  const task = board.tasks.find(t => t.id === taskId);
  if (task) { task.headerContent = headerContent; saveBoard(board); }
}

export function getAssignedSessionIds(): Set<string> {
  const board = loadBoard();
  const ids = new Set<string>();
  for (const task of board.tasks) {
    for (const s of task.sessions) ids.add(s.sessionId);
  }
  return ids;
}
