import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FileExplorer } from './FileExplorer';

export class NodeDependenciesProvider implements vscode.TreeDataProvider<FileItem> {
  constructor(private rootPath: string) {}

  getTreeItem(element: FileItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: FileItem): Thenable<FileItem[]> {
    if (!this.rootPath) {
      vscode.window.showInformationMessage('No folder selected');
      return Promise.resolve([]);
    }

    const targetPath = element && element.resourceUri ? element.resourceUri.fsPath : this.rootPath;
    return Promise.resolve(this.getFilesInDirectory(targetPath));
  }

  private getFilesInDirectory(directory: string): FileItem[] {
    if (!this.pathExists(directory)) {
      return [];
    }

    return fs.readdirSync(directory).map(name => {
      const fullPath = path.join(directory, name);
      const isDirectory = fs.statSync(fullPath).isDirectory();
      return new FileItem(name, vscode.Uri.file(fullPath), isDirectory ?
        vscode.TreeItemCollapsibleState.Collapsed :
        vscode.TreeItemCollapsibleState.None);
    });
  }

  private pathExists(p: string): boolean {
    try {
      fs.accessSync(p);
    } catch (err) {
      return false;
    }
    return true;
  }
}

class FileItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly resourceUri: vscode.Uri,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.resourceUri = resourceUri;
    this.tooltip = this.label;
    this.description = '';
  }

  iconPath = {
    light: vscode.Uri.file(path.join(__dirname, '..', '..', 'resources', 'light', 'file.svg')),
    dark: vscode.Uri.file(path.join(__dirname, '..', '..', 'resources', 'dark', 'file.svg'))
  };
}

const rootPath = 'C:/Users/Kinso/Desktop/LOG/VFM_Hybrid_parameterLogs';

if (rootPath) {
  const fileSystemExplorer = new FileExplorer(rootPath);
  vscode.window.registerTreeDataProvider('vfmtoolkit.fileExplorer', fileSystemExplorer);
  // vscode.window.createTreeView('vfmtoolkit.fileExplorer', { // createTreeView is implicitly called by registerTreeDataProvider if view id matches
  //   treeDataProvider: fileSystemExplorer
  // });
} else {
  vscode.window.showInformationMessage('VFM Toolkit: No workspace folder open to show file explorer.');
}

// For the custom UI view that shows action items
const customUiViewProvider = new FileExplorer(FileExplorer.CUSTOM_UI_VIEW_ID);
vscode.window.registerTreeDataProvider('vfmtoolkit.customUIView', customUiViewProvider);
// vscode.window.createTreeView('vfmtoolkit.customUIView', { // createTreeView is implicitly called
//   treeDataProvider: customUiViewProvider
// });

// Register commands that the custom UI items will trigger
let inputBoxCommand = vscode.commands.registerCommand('vfmtoolkit.showInputBox', () => {
  const inputBox = vscode.window.createInputBox();
  inputBox.title = 'Custom Input Box';
  inputBox.placeholder = 'Enter your text here...';
  inputBox.prompt = '输入无线连接IP:端口';
  inputBox.value = 'Default value';
  inputBox.onDidAccept(() => {
    vscode.window.showInformationMessage(`Input accepted: ${inputBox.value}`);
    inputBox.hide();
  });
  inputBox.onDidHide(() => inputBox.dispose());
  inputBox.show();
});

let statusBarButtonCommand = vscode.commands.registerCommand('vfmtoolkit.showStatusBarButton', () => {
  const button = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  button.text = `$(check) My Button`;
  button.tooltip = 'Click this custom button';
  button.command = 'vfmtoolkit.dummyAction'; // Example: make it trigger another command or just be informational
  button.show();
  // vscode.window.showInformationMessage('Status bar button created!');
  // Keep the button for a while or manage its lifecycle as needed
  setTimeout(() => button.dispose(), 10000); // Dispose after 10 seconds for this example
});

// A dummy command for the status bar button to execute if clicked
vscode.commands.registerCommand('vfmtoolkit.dummyAction', () => {
  vscode.window.showInformationMessage('Dummy action executed from status bar button!');
});

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "vfmtoolkit" is now active!');
	context.subscriptions.push(inputBoxCommand);
	context.subscriptions.push(statusBarButtonCommand);
  // The tree data providers are already registered globally, no need to push them to subscriptions unless managing their disposal specifically.
}

export function deactivate() {}
