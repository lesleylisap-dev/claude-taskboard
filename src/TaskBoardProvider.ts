import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { readAllSessions, SessionMeta } from './ConversationReader';
import {
  loadBoard, createTask, assignSession, removeSession,
  archiveTask, unarchiveTask, deleteTask, renameSession, getAssignedSessionIds,
  updateTaskHeader,
  Task, TaskBoard,
} from './Storage';

export class TaskBoardProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'claudeTaskboard.taskBoard';
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };
    webviewView.webview.html = this._getHtml(webviewView.webview);
    this._setMessageHandler(webviewView.webview);
    // Send initial data
    this._sendData(webviewView.webview);
  }

  public refresh(): void {
    if (this._view) {
      this._sendData(this._view.webview);
    }
  }

  private _sendData(webview: vscode.Webview): void {
    const board = loadBoard();
    const allSessions = readAllSessions();
    const assignedIds = getAssignedSessionIds();
    const unassigned = allSessions.filter(s => !assignedIds.has(s.sessionId));
    const sessionMap: Record<string, SessionMeta> = {};
    allSessions.forEach(s => { sessionMap[s.sessionId] = s; });

    webview.postMessage({
      type: 'data',
      board,
      unassigned,
      sessionMap,
    });
  }

  private _setMessageHandler(webview: vscode.Webview): void {
    webview.onDidReceiveMessage(msg => {
      switch (msg.type) {
        case 'createTask':
          createTask(msg.name, msg.color);
          break;
        case 'assignSession':
          assignSession(msg.taskId, msg.sessionId, msg.label);
          break;
        case 'removeSession':
          removeSession(msg.taskId, msg.sessionId);
          break;
        case 'archiveTask':
          archiveTask(msg.taskId);
          break;
        case 'unarchiveTask':
          unarchiveTask(msg.taskId);
          break;
        case 'deleteTask':
          deleteTask(msg.taskId);
          break;
        case 'renameSession':
          renameSession(msg.taskId, msg.sessionId, msg.label);
          break;
        case 'updateTaskHeader':
          updateTaskHeader(msg.taskId, msg.headerContent);
          break;
        case 'resumeSession':
          this._resumeSession(msg.sessionId);
          return; // no refresh needed
        case 'newSession':
          this._newSession(msg.taskId);
          return; // no refresh needed
        case 'refresh':
          break;
      }
      this._sendData(webview);
    });
  }

  private _resumeSession(sessionId: string): void {
    const uri = vscode.Uri.parse(`vscode://anthropic.claude-code/open?session=${sessionId}`);
    vscode.env.openExternal(uri);
  }

  private _newSession(taskId: string | null): void {
    if (!taskId) {
      vscode.commands.executeCommand('claude-vscode.newConversation');
      return;
    }

    const board = loadBoard();
    const task = board.tasks.find(t => t.id === taskId);
    if (!task) return;

    const sessionDir = path.join(os.homedir(), '.claude', 'task-sessions', taskId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    const claudeMdPath = path.join(sessionDir, 'CLAUDE.md');
    fs.writeFileSync(claudeMdPath, task.headerContent ?? '', 'utf8');

    vscode.commands.executeCommand('claude-vscode.newConversation');
  }

  private _getHtml(webview: vscode.Webview): string {
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

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
