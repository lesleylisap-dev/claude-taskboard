'use strict';
const vscode = require('vscode');
const path = require('path');
const { readAllSessions } = require('./ConversationReader');
const {
  loadBoard, createTask, assignSession, removeSession,
  archiveTask, unarchiveTask, deleteTask, renameSession, getAssignedSessionIds,
  updateTaskHeader,
} = require('./Storage');

class TaskBoardProvider {
  constructor(extensionUri) {
    this._extensionUri = extensionUri;
    this._view = undefined;
  }

  resolveWebviewView(webviewView, _context, _token) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };
    webviewView.webview.html = this._getHtml(webviewView.webview);
    this._setMessageHandler(webviewView.webview);
    this._sendData(webviewView.webview);
  }

  refresh() {
    if (this._view) this._sendData(this._view.webview);
  }

  _sendData(webview) {
    const board = loadBoard();
    const allSessions = readAllSessions();
    const assignedIds = getAssignedSessionIds();
    const unassigned = allSessions.filter(s => !assignedIds.has(s.sessionId));
    // Full lookup map so assigned sessions can also show metadata
    const sessionMap = {};
    allSessions.forEach(s => { sessionMap[s.sessionId] = s; });
    webview.postMessage({ type: 'data', board, unassigned, sessionMap });
  }

  _setMessageHandler(webview) {
    webview.onDidReceiveMessage(msg => {
      switch (msg.type) {
        case 'createTask':    createTask(msg.name, msg.color); break;
        case 'assignSession': assignSession(msg.taskId, msg.sessionId, msg.label); break;
        case 'removeSession': removeSession(msg.taskId, msg.sessionId); break;
        case 'archiveTask':   archiveTask(msg.taskId); break;
        case 'unarchiveTask': unarchiveTask(msg.taskId); break;
        case 'deleteTask':    deleteTask(msg.taskId); break;
        case 'renameSession': renameSession(msg.taskId, msg.sessionId, msg.label); break;
        case 'updateTaskHeader': updateTaskHeader(msg.taskId, msg.headerContent); break;
        case 'resumeSession': this._resumeSession(msg.sessionId); return;
        case 'newSession':    this._newSession(msg.taskId); return;
        case 'refresh': break;
      }
      this._sendData(webview);
    });
  }

  _resumeSession(sessionId) {
    // Open in Claude for VS Code native UI via URI handler
    const uri = vscode.Uri.parse(`vscode://anthropic.claude-code/open?session=${sessionId}`);
    vscode.env.openExternal(uri);
  }

  _newSession(taskId) {
    const os = require('os');
    const fs = require('fs');

    if (!taskId) {
      // Toolbar button — open a plain new terminal session
      const terminal = vscode.window.createTerminal({ name: 'Claude' });
      terminal.show();
      terminal.sendText('claude');
      return;
    }

    const board = loadBoard();
    const task = board.tasks.find(t => t.id === taskId);
    if (!task) return;

    const { getProjectsDir } = require('./ConversationReader');
    const projDir = getProjectsDir();

    // Snapshot existing session IDs before opening terminal
    const existingIds = new Set(
      fs.existsSync(projDir)
        ? fs.readdirSync(projDir).filter(f => f.endsWith('.jsonl')).map(f => f.replace('.jsonl', ''))
        : []
    );

    // Start Claude in home dir so JSONL lands in C--Users-I327394 (scanned by ConversationReader)
    const terminal = vscode.window.createTerminal({
      name: `Claude: ${task.name}`,
      cwd: os.homedir(),
    });
    terminal.show();
    terminal.sendText('claude');

    // Poll for new JSONL file and auto-assign to this task (60s timeout)
    const webview = this._view?.webview;
    let elapsed = 0;
    const poll = setInterval(() => {
      elapsed += 1500;
      try {
        if (fs.existsSync(projDir)) {
          const newFile = fs.readdirSync(projDir)
            .filter(f => f.endsWith('.jsonl'))
            .find(f => !existingIds.has(f.replace('.jsonl', '')));
          if (newFile) {
            assignSession(taskId, newFile.replace('.jsonl', ''), null);
            clearInterval(poll);
            if (webview) this._sendData(webview);
          }
        }
      } catch {}
      if (elapsed >= 60000) clearInterval(poll);
    }, 1500);
  }

  _getHtml(webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'style.css'),
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
  <title>Claude 任务板</title>
</head>
<body>
  <div id="app">
    <div id="toolbar">
      <span id="title">Claude 任务板</span>
      <button id="newSessionBtn" class="btn-ghost" title="新建 Claude Session">＋ Session</button>
      <button id="newTaskBtn" class="btn-primary" title="新建任务">＋ 任务</button>
    </div>

    <div id="newTaskForm" class="hidden">
      <input id="newTaskName" type="text" placeholder="任务名称..." maxlength="60">
      <div id="colorPicker"></div>
      <div class="form-actions">
        <button id="createTaskBtn" class="btn-primary">创建</button>
        <button id="cancelTaskBtn" class="btn-ghost">取消</button>
      </div>
    </div>

    <div id="activeTasks"></div>

    <div id="archivedSection">
      <div id="archivedHeader" class="section-header collapsed" data-section="archived">
        <span class="chevron">▶</span>
        <span>已归档</span>
        <span id="archivedCount" class="badge">0</span>
      </div>
      <div id="archivedTasks" class="hidden"></div>
    </div>

    <div id="unassignedSection">
      <div id="unassignedHeader" class="section-header" data-section="unassigned">
        <span class="chevron expanded">▼</span>
        <span>未分配 Sessions</span>
        <span id="unassignedCount" class="badge">0</span>
        <input id="searchInput" type="text" placeholder="搜索..." class="search-box" onclick="event.stopPropagation()">
      </div>
      <div id="unassignedList"></div>
    </div>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce() {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) text += chars[Math.floor(Math.random() * chars.length)];
  return text;
}

module.exports = { TaskBoardProvider };
