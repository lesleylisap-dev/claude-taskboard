'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const boardFile = path.join(os.homedir(), '.claude', 'taskboard.json');

const DEFAULT_COLORS = [
  '#4CAF50', '#2196F3', '#FF9800', '#E91E63',
  '#9C27B0', '#00BCD4', '#FF5722', '#607D8B',
];

function loadBoard() {
  if (!fs.existsSync(boardFile)) return { tasks: [] };
  try { return JSON.parse(fs.readFileSync(boardFile, 'utf8')); }
  catch { return { tasks: [] }; }
}

function saveBoard(board) {
  fs.writeFileSync(boardFile, JSON.stringify(board, null, 2), 'utf8');
}

function createTask(name, color) {
  const board = loadBoard();
  const idx = board.tasks.length % DEFAULT_COLORS.length;
  const task = {
    id: crypto.randomUUID(),
    name,
    color: color || DEFAULT_COLORS[idx],
    status: 'active',
    createdAt: new Date().toISOString(),
    sessions: [],
  };
  board.tasks.unshift(task);
  saveBoard(board);
  return task;
}

function assignSession(taskId, sessionId, label) {
  const board = loadBoard();
  const task = board.tasks.find(t => t.id === taskId);
  if (!task) return;
  if (task.sessions.some(s => s.sessionId === sessionId)) return;
  task.sessions.unshift({ sessionId, label, addedAt: new Date().toISOString() });
  saveBoard(board);
}

function removeSession(taskId, sessionId) {
  const board = loadBoard();
  const task = board.tasks.find(t => t.id === taskId);
  if (!task) return;
  task.sessions = task.sessions.filter(s => s.sessionId !== sessionId);
  saveBoard(board);
}

function archiveTask(taskId) {
  const board = loadBoard();
  const task = board.tasks.find(t => t.id === taskId);
  if (task) { task.status = 'archived'; saveBoard(board); }
}

function unarchiveTask(taskId) {
  const board = loadBoard();
  const task = board.tasks.find(t => t.id === taskId);
  if (task) { task.status = 'active'; saveBoard(board); }
}

function deleteTask(taskId) {
  const board = loadBoard();
  board.tasks = board.tasks.filter(t => t.id !== taskId);
  saveBoard(board);
}

function renameSession(taskId, sessionId, label) {
  const board = loadBoard();
  const task = board.tasks.find(t => t.id === taskId);
  if (!task) return;
  const s = task.sessions.find(x => x.sessionId === sessionId);
  if (s) { s.label = label; saveBoard(board); }
}

function updateTaskHeader(taskId, headerContent) {
  const board = loadBoard();
  const task = board.tasks.find(t => t.id === taskId);
  if (task) { task.headerContent = headerContent; saveBoard(board); }
}

function getAssignedSessionIds() {
  const board = loadBoard();
  const ids = new Set();
  for (const task of board.tasks) {
    for (const s of task.sessions) ids.add(s.sessionId);
  }
  return ids;
}

module.exports = {
  loadBoard, saveBoard, createTask, assignSession, removeSession,
  archiveTask, unarchiveTask, deleteTask, renameSession, getAssignedSessionIds,
  updateTaskHeader,
};
