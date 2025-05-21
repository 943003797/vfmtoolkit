import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class FileExplorer implements vscode.TreeDataProvider<FileItem> {
  public static readonly CUSTOM_UI_VIEW_ID = 'VFMTOOLKIT_CUSTOM_UI_VIEW'; // Special identifier for the custom view
  
  // 添加事件发射器用于刷新视图
  public _onDidChangeTreeData: vscode.EventEmitter<FileItem | undefined | null | void> = new vscode.EventEmitter<FileItem | undefined | null | void>();
  public readonly onDidChangeTreeData: vscode.Event<FileItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor(private viewIdOrRootPath: string) {}

  getTreeItem(element: FileItem): vscode.TreeItem {
    return element; // The element is already configured
  }

  getChildren(element?: FileItem): Thenable<FileItem[]> {
    if (this.viewIdOrRootPath === FileExplorer.CUSTOM_UI_VIEW_ID) {
      // This is for the custom UI view (e.g., vfmtoolkit-input-box)
      if (element) {
        // Custom items like "Display Input Box" don't have children
        return Promise.resolve([]);
      }

      // Create items that trigger commands
      // Create items that trigger commands
      const buttonItem = new FileItem(
        'Display Status Bar Button',
        'vfmtoolkit-button-trigger', // Unique ID, not a file path
        vscode.TreeItemCollapsibleState.None,
        { command: 'vfmtoolkit.showStatusBarButton', title: 'Show Status Bar Button' }
      );
      // buttonItem.iconPath = new vscode.ThemeIcon('check'); // Optional: specific icon
      
      const pullVfmLogsItem = new FileItem(
        '拉取VFM日志文件',
        'vfmtoolkit-pull-vfm-logs-trigger', // Unique ID, not a file path
        vscode.TreeItemCollapsibleState.None,
        { command: 'vfmtoolkit.pullVfmLogs', title: '从Android设备拉取VFM日志文件' }
      );
      pullVfmLogsItem.iconPath = new vscode.ThemeIcon('cloud-download');


      return Promise.resolve([buttonItem, pullVfmLogsItem]);
    } else {
      // This is for the standard file explorer view
      const rootPathForExplorer = this.viewIdOrRootPath;
      if (!rootPathForExplorer || rootPathForExplorer === FileExplorer.CUSTOM_UI_VIEW_ID) {
        // vscode.window.showInformationMessage('No folder selected for file explorer.');
        return Promise.resolve([]); // Or handle as an error/empty state
      }

      const targetPath = element?.resourceUri?.fsPath || rootPathForExplorer;

      if (!this.pathExists(targetPath) || !fs.statSync(targetPath).isDirectory()) {
        return Promise.resolve([]);
      }
      return Promise.resolve(this.getFilesInDirectory(targetPath));
    }
  }

  private getFilesInDirectory(directory: string): FileItem[] {
    if (!this.pathExists(directory)) {
      return [];
    }

    return fs.readdirSync(directory).map(name => {
      const fullPath = path.join(directory, name);
      const stat = fs.statSync(fullPath);
      const isDirectory = stat.isDirectory();

      let command: vscode.Command | undefined = undefined;
      if (!isDirectory) {
        command = {
          command: 'vscode.open',
          title: 'Open File',
          arguments: [vscode.Uri.file(fullPath)]
        };
      }

      return new FileItem(
        name,
        fullPath,
        isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        command
      );
    });
  }

  private pathExists(p: string): boolean {
    try {
      fs.accessSync(p);
      return true;
    } catch (err) {
      return false;
    }
  }
}

class FileItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly fullPathOrId: string, // Can be a file path or a unique ID for custom items
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    command?: vscode.Command // Optional command for the item
  ) {
    super(label, collapsibleState);
    this.command = command;
    this.tooltip = `${this.label}`; // Basic tooltip

    let isFileSystemItem = false;
    try {
        if (fs.existsSync(fullPathOrId)) {
            const stat = fs.statSync(fullPathOrId);
            this.resourceUri = vscode.Uri.file(fullPathOrId);
            isFileSystemItem = true;
            if (stat.isFile()) {
                this.iconPath = { // Default file icon
                    light: vscode.Uri.file(path.join(__dirname, '..', '..', 'resources', 'light', 'file.svg')),
                    dark: vscode.Uri.file(path.join(__dirname, '..', '..', 'resources', 'dark', 'file.svg'))
                };
                if (!this.command) {
                    this.command = {
                        command: 'vscode.open',
                        title: 'Open File',
                        arguments: [this.resourceUri]
                    };
                }
            } else if (stat.isDirectory()) {
                this.iconPath = vscode.ThemeIcon.Folder;
            }
        }
    } catch (error) {
        // Not a valid file system path or error accessing it. Assume custom item.
    }

    if (!isFileSystemItem) {
        this.description = `Action`; 
        this.id = fullPathOrId;
        if (this.fullPathOrId === 'vfmtoolkit-input-box-trigger') {
            this.iconPath = new vscode.ThemeIcon('edit');
        } else if (this.fullPathOrId === 'vfmtoolkit-button-trigger') {
            this.iconPath = new vscode.ThemeIcon('check');
        }
    }
  }
}