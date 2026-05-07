// @ts-check
/// <reference lib="dom" />

const vscode = acquireVsCodeApi();

const COLORS = [
  '#4CAF50','#2196F3','#FF9800','#E91E63',
  '#9C27B0','#00BCD4','#FF5722','#607D8B',
];

let state = { board: { tasks: [] }, unassigned: [], sessionMap: {} };
let selectedColor = COLORS[0];
let archivedOpen = false;
let unassignedOpen = true;
let searchQuery = '';
let draggedSessionId = null;

// ── Init ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupColorPicker();
  setupNewTaskForm();
  setupSectionHeaders();
  setupSearch();

  document.getElementById('newSessionBtn')?.addEventListener('click', () => {
    vscode.postMessage({ type: 'newSession', taskId: null });
  });
});

window.addEventListener('message', (event) => {
  const msg = event.data;
  if (msg.type === 'data') {
    state = msg;
    render();
  }
});

// ── Color Picker ──────────────────────────────────────────────────────────
function setupColorPicker() {
  const picker = document.getElementById('colorPicker');
  COLORS.forEach((c, i) => {
    const dot = document.createElement('span');
    dot.className = 'color-dot' + (i === 0 ? ' selected' : '');
    dot.style.background = c;
    dot.title = c;
    dot.dataset.color = c;
    dot.addEventListener('click', () => {
      document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected');
      selectedColor = c;
    });
    picker.appendChild(dot);
  });
}

// ── New Task Form ─────────────────────────────────────────────────────────
function setupNewTaskForm() {
  const newTaskBtn = document.getElementById('newTaskBtn');
  const form = document.getElementById('newTaskForm');
  const nameInput = /** @type {HTMLInputElement} */ (document.getElementById('newTaskName'));
  const createBtn = document.getElementById('createTaskBtn');
  const cancelBtn = document.getElementById('cancelTaskBtn');

  newTaskBtn.addEventListener('click', () => {
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) {
      nameInput.value = '';
      nameInput.focus();
    }
  });

  cancelBtn.addEventListener('click', () => form.classList.add('hidden'));

  createBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) return;
    vscode.postMessage({ type: 'createTask', name, color: selectedColor });
    form.classList.add('hidden');
  });

  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createBtn.click();
    if (e.key === 'Escape') cancelBtn.click();
  });
}

// ── Section Headers ───────────────────────────────────────────────────────
function setupSectionHeaders() {
  document.getElementById('archivedHeader').addEventListener('click', () => {
    archivedOpen = !archivedOpen;
    updateSectionVisibility();
  });
  document.getElementById('unassignedHeader').addEventListener('click', (e) => {
    if (e.target === document.getElementById('searchInput')) return;
    unassignedOpen = !unassignedOpen;
    updateSectionVisibility();
  });
}

function updateSectionVisibility() {
  const archivedList = document.getElementById('archivedTasks');
  const archivedHeader = document.getElementById('archivedHeader');
  const unassignedList = document.getElementById('unassignedList');
  const unassignedHeader = document.getElementById('unassignedHeader');

  if (archivedOpen) {
    archivedList.classList.remove('hidden');
    archivedHeader.querySelector('.chevron').textContent = '▼';
  } else {
    archivedList.classList.add('hidden');
    archivedHeader.querySelector('.chevron').textContent = '▶';
  }

  if (unassignedOpen) {
    unassignedList.classList.remove('hidden');
    unassignedHeader.querySelector('.chevron').textContent = '▼';
    unassignedHeader.querySelector('.chevron').classList.add('expanded');
  } else {
    unassignedList.classList.add('hidden');
    unassignedHeader.querySelector('.chevron').textContent = '▶';
    unassignedHeader.querySelector('.chevron').classList.remove('expanded');
  }
}

// ── Search ────────────────────────────────────────────────────────────────
function setupSearch() {
  const input = document.getElementById('searchInput');
  input.addEventListener('input', (e) => {
    searchQuery = /** @type {HTMLInputElement} */ (e.target).value.toLowerCase();
    renderUnassigned();
  });
  input.addEventListener('keydown', (e) => e.stopPropagation());
}

// ── Render ────────────────────────────────────────────────────────────────
function render() {
  renderActiveTasks();
  renderArchivedTasks();
  renderUnassigned();
  updateSectionVisibility();
}

function renderActiveTasks() {
  const container = document.getElementById('activeTasks');
  const active = state.board.tasks.filter(t => t.status === 'active');
  container.innerHTML = '';

  if (active.length === 0) {
    container.innerHTML = '<div class="empty-state">暂无进行中的任务<br>点击「＋ 新任务」开始</div>';
    return;
  }
  active.forEach(task => container.appendChild(createTaskCard(task, false)));
}

function renderArchivedTasks() {
  const container = document.getElementById('archivedTasks');
  const archived = state.board.tasks.filter(t => t.status === 'archived');
  document.getElementById('archivedCount').textContent = String(archived.length);
  container.innerHTML = '';
  archived.forEach(task => container.appendChild(createTaskCard(task, true)));
}

function renderUnassigned() {
  const container = document.getElementById('unassignedList');
  container.innerHTML = '';
  const activeTasks = state.board.tasks.filter(t => t.status === 'active');

  let list = state.unassigned;
  if (searchQuery) {
    list = list.filter(s =>
      s.firstPrompt.toLowerCase().includes(searchQuery) ||
      s.sessionId.includes(searchQuery)
    );
  }

  document.getElementById('unassignedCount').textContent = String(state.unassigned.length);

  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:10px">无未分配 sessions</div>';
    return;
  }

  list.slice(0, 100).forEach(s => {
    const item = document.createElement('div');
    item.className = 'unassigned-item';
    item.draggable = true;
    item.dataset.sessionId = s.sessionId;

    const title = s.firstPrompt || s.sessionId.slice(0, 8) + '...';
    const timeStr = relativeTime(s.startTime);
    const dur = s.durationMinutes > 0 ? `${s.durationMinutes}min` : '';
    const msgs = s.userMessageCount > 0 ? `${s.userMessageCount}条` : '';

    item.innerHTML = `
      <span class="session-icon">💬</span>
      <div class="session-info">
        <div class="session-title" title="${escHtml(title)}">${escHtml(title)}</div>
        <div class="session-meta">
          <span>${timeStr}</span>
          ${dur ? `<span>${dur}</span>` : ''}
          ${msgs ? `<span>${msgs}</span>` : ''}
        </div>
      </div>
      <select class="assign-select" title="分配到任务">
        <option value="">分配到…</option>
        ${activeTasks.map(t => `<option value="${t.id}">${escHtml(t.name)}</option>`).join('')}
      </select>
    `;

    const select = item.querySelector('select');
    select.addEventListener('change', () => {
      if (!select.value) return;
      vscode.postMessage({ type: 'assignSession', taskId: select.value, sessionId: s.sessionId });
      select.value = '';
    });

    // Drag events
    item.addEventListener('dragstart', (e) => {
      draggedSessionId = s.sessionId;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', s.sessionId);
    });
    item.addEventListener('dragend', () => {
      draggedSessionId = null;
      item.classList.remove('dragging');
    });

    container.appendChild(item);
  });
}

// ── Task Card ─────────────────────────────────────────────────────────────
function createTaskCard(task, isArchived) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.dataset.taskId = task.id;

  // Build session info for display (enrich with unassigned-style data if available)
  const sessionsHtml = buildSessionsHtml(task);
  const hasNoSessions = task.sessions.length === 0;

  card.innerHTML = `
    <div class="task-header">
      <span class="task-color-bar" style="background:${task.color}"></span>
      <span class="task-name" title="${escHtml(task.name)}">${escHtml(task.name)}</span>
      <span class="task-session-count">${task.sessions.length} session${task.sessions.length !== 1 ? 's' : ''}</span>
      <div class="task-actions">
        ${isArchived
          ? `<button class="btn-icon unarchive-btn" title="恢复">↩</button>`
          : `<button class="btn-icon edit-header-btn" title="编辑任务背景">✎</button>
             <button class="btn-icon new-session-btn" title="新建 Session 并自动归属此任务">＋</button>
             <button class="btn-icon archive-btn" title="归档">✓</button>`
        }
        <button class="btn-icon delete-btn" title="删除任务">✕</button>
      </div>
      <span class="task-chevron open">▶</span>
    </div>
    <div class="session-list">
      ${hasNoSessions
        ? `<div class="drop-hint">将 session 拖拽到此处</div>`
        : sessionsHtml
      }
    </div>
    <div class="header-editor hidden">
      <textarea class="header-textarea"
        placeholder="任务背景说明（将写入新 Session 的 CLAUDE.md）..."
        rows="5">${escHtml(task.headerContent ?? '')}</textarea>
      <div class="header-editor-actions">
        <button class="save-header-btn btn-primary">保存</button>
        <button class="cancel-header-btn btn-ghost">取消</button>
      </div>
    </div>
  `;

  const header = card.querySelector('.task-header');
  const sessionList = card.querySelector('.session-list');
  const chevron = card.querySelector('.task-chevron');
  let open = true;

  header.addEventListener('click', (e) => {
    if ((e.target).closest('.task-actions')) return;
    open = !open;
    sessionList.style.display = open ? '' : 'none';
    chevron.classList.toggle('open', open);
  });

  card.querySelector('.edit-header-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const editor = card.querySelector('.header-editor');
    editor.classList.toggle('hidden');
    if (!editor.classList.contains('hidden')) {
      card.querySelector('.header-textarea').focus();
    }
  });

  card.querySelector('.save-header-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const content = card.querySelector('.header-textarea').value;
    vscode.postMessage({ type: 'updateTaskHeader', taskId: task.id, headerContent: content });
    card.querySelector('.header-editor').classList.add('hidden');
  });

  card.querySelector('.cancel-header-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    card.querySelector('.header-textarea').value = task.headerContent ?? '';
    card.querySelector('.header-editor').classList.add('hidden');
  });

  card.querySelector('.archive-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    vscode.postMessage({ type: 'archiveTask', taskId: task.id });
  });
  card.querySelector('.new-session-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    vscode.postMessage({ type: 'newSession', taskId: task.id });
  });
  card.querySelector('.unarchive-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    vscode.postMessage({ type: 'unarchiveTask', taskId: task.id });
  });
  card.querySelector('.delete-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm(`删除任务"${task.name}"？（session 不会被删除）`)) {
      vscode.postMessage({ type: 'deleteTask', taskId: task.id });
    }
  });

  // Wire resume buttons
  card.querySelectorAll('.resume-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      vscode.postMessage({ type: 'resumeSession', sessionId: btn.dataset.sessionId });
    });
  });

  // Wire remove-session buttons
  card.querySelectorAll('.remove-session-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      vscode.postMessage({ type: 'removeSession', taskId: task.id, sessionId: btn.dataset.sessionId });
    });
  });

  // Wire rename: click on session title to edit inline
  card.querySelectorAll('.session-title-text').forEach(titleEl => {
    titleEl.addEventListener('click', (e) => {
      e.stopPropagation();
      startRename(titleEl, task.id, titleEl.dataset.sessionId, titleEl.dataset.currentLabel);
    });
  });

  // Drop zone
  if (!isArchived) {
    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      card.classList.add('drag-over');
    });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      const sid = e.dataTransfer.getData('text/plain') || draggedSessionId;
      if (sid) {
        vscode.postMessage({ type: 'assignSession', taskId: task.id, sessionId: sid });
      }
    });
  }

  return card;
}

function buildSessionsHtml(task) {
  return task.sessions.map(ts => {
    // Use full sessionMap (includes assigned sessions), fall back to addedAt
    const meta = state.sessionMap[ts.sessionId];
    const displayLabel = ts.label || (meta ? meta.firstPrompt : '') || ts.sessionId.slice(0, 20) + '…';
    const timeStr = meta ? relativeTime(meta.startTime) : relativeTime(ts.addedAt);
    const dur = meta && meta.durationMinutes > 0 ? `${meta.durationMinutes}min` : '';
    const msgs = meta && meta.userMessageCount > 0 ? `${meta.userMessageCount}条` : '';

    return `
      <div class="session-item">
        <span class="session-icon">💬</span>
        <div class="session-info">
          <div class="session-title">
            <span class="session-title-text"
              data-session-id="${ts.sessionId}"
              data-current-label="${escHtml(displayLabel)}"
              title="点击改名">${escHtml(displayLabel)}</span>
          </div>
          <div class="session-meta">
            <span>${timeStr}</span>
            ${dur ? `<span>${dur}</span>` : ''}
            ${msgs ? `<span>${msgs}</span>` : ''}
          </div>
        </div>
        <div class="session-actions">
          <button class="resume-btn" data-session-id="${ts.sessionId}" title="续接此对话">▶ 续</button>
          <button class="btn-icon remove-session-btn" data-session-id="${ts.sessionId}" title="移出任务">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

function startRename(titleEl, taskId, sessionId, currentLabel) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentLabel;
  input.style.cssText = 'width:100%;background:var(--color-input-bg);border:1px solid var(--color-btn-bg);color:var(--color-input-fg);padding:1px 4px;border-radius:3px;font-size:12px;outline:none;';

  titleEl.replaceWith(input);
  input.focus();
  input.select();

  const restore = (label) => {
    const span = document.createElement('span');
    span.className = 'session-title-text';
    span.dataset.sessionId = sessionId;
    span.dataset.currentLabel = label;
    span.title = '点击改名';
    span.textContent = label;
    input.replaceWith(span);
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      startRename(span, taskId, sessionId, label);
    });
  };

  input.addEventListener('blur', () => {
    const newLabel = input.value.trim();
    if (newLabel && newLabel !== currentLabel) {
      vscode.postMessage({ type: 'renameSession', taskId, sessionId, label: newLabel });
      // Optimistically update the label shown while waiting for data refresh
      restore(newLabel);
    } else {
      restore(currentLabel);
    }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.value = currentLabel; input.blur(); }
    e.stopPropagation();
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────
function relativeTime(isoStr) {
  if (!isoStr) return '';
  const diff = Date.now() - new Date(isoStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}天前`;
  const mo = Math.floor(d / 30);
  return `${mo}个月前`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
