import * as vscode from 'vscode';
import * as fs from 'fs';
import { TaskBoardProvider } from './TaskBoardProvider';
import { getSessionMetaDir } from './ConversationReader';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new TaskBoardProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      TaskBoardProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeTaskboard.refresh', () => {
      provider.refresh();
    }),
  );

  // Watch for new sessions and auto-refresh
  const metaDir = getSessionMetaDir();
  if (fs.existsSync(metaDir)) {
    const watcher = fs.watch(metaDir, () => {
      provider.refresh();
    });
    context.subscriptions.push({
      dispose: () => watcher.close(),
    });
  }
}

export function deactivate(): void {}
