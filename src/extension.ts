import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FileExplorer } from './FileExplorer';
import { exec } from 'child_process';

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

// 获取插件上下文
// 将rootPath的定义移动到activate函数中
let rootPath: string;

// 声明为全局变量以便其他函数访问
let fileSystemExplorer: FileExplorer;

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "vfmtoolkit" is now active!');
    
    // 获取全局存储路径
    rootPath = context ? context.globalStorageUri.fsPath : 'C:/Users/Kinso/Desktop/LOG';

    if (rootPath) {
        fileSystemExplorer = new FileExplorer(rootPath + '/VFM_Hybrid_parameterLogs');
        vscode.window.registerTreeDataProvider('vfmtoolkit.fileExplorer', fileSystemExplorer);
    } else {
        vscode.window.showInformationMessage('VFM Toolkit: No workspace folder open to show file explorer.');
    }

    context.subscriptions.push(inputBoxCommand);
    context.subscriptions.push(statusBarButtonCommand);
    context.subscriptions.push(pullVfmLogsCommand);
}

// For the custom UI view that shows action items
const customUiViewProvider = new FileExplorer(FileExplorer.CUSTOM_UI_VIEW_ID);
vscode.window.registerTreeDataProvider('vfmtoolkit.customUIView', customUiViewProvider);
// vscode.window.createTreeView('vfmtoolkit.customUIView', { // createTreeView is implicitly called
//   treeDataProvider: customUiViewProvider
// });

// 创建一个函数用于刷新文件浏览器
function refreshFileExplorer() {
  if (fileSystemExplorer) {
    // 触发文件浏览器刷新
    vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
    // 如果FileExplorer类有刷新方法，也可以直接调用
    if (fileSystemExplorer._onDidChangeTreeData) {
      fileSystemExplorer._onDidChangeTreeData.fire();
    }
  }
}

// Register commands that the custom UI items will trigger
let inputBoxCommand = vscode.commands.registerCommand('vfmtoolkit.showInputBox', () => {
  const inputBox = vscode.window.createInputBox();
  inputBox.title = 'Android无线调试连接';
  inputBox.placeholder = '请输入IP:端口';
  inputBox.prompt = '输入安卓设备的IP地址和端口号，例如：192.168.1.100:5555';
  inputBox.onDidAccept(() => {
    const ipPort = inputBox.value.trim();
    if (/^\d{1,3}(\.\d{1,3}){3}:\d{1,5}$/.test(ipPort)) {
      // 执行ADB连接命令
      const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
      statusBarItem.text = `$(loading~spin) 正在连接: ${ipPort}`;
      statusBarItem.show();
      
      exec(`adb connect ${ipPort}`, (error, stdout, stderr) => {
        statusBarItem.hide();
        if (error) {
          vscode.window.showErrorMessage(`连接失败: ${error.message}`);
          return;
        }
        
        if (stderr) {
          vscode.window.showErrorMessage(`连接错误: ${stderr}`);
          return;
        }
        
        // 检查连接结果
        if (stdout.includes('connected') || stdout.includes('already connected')) {
          vscode.window.showInformationMessage(`成功连接到设备: ${ipPort}`);
          // 连接成功后检查设备列表
          exec('adb devices', (err, devicesOutput) => {
            if (!err && devicesOutput) {
              console.log('已连接设备列表:', devicesOutput);
            }
          });
        } else {
          vscode.window.showWarningMessage(`连接响应: ${stdout}`);
        }
      });
      
      inputBox.hide();
    } else {
      vscode.window.showErrorMessage('请输入有效的IP:端口格式');
    }
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

// 注册一个命令用于从Android设备拉取VFM日志文件
let pullVfmLogsCommand = vscode.commands.registerCommand('vfmtoolkit.pullVfmLogs', () => {
  // 创建状态栏项显示进度
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = `$(loading~spin) 正在从设备获取VFM日志...`;
  statusBarItem.show();
  
  // 确保目标目录存在
  if (!fs.existsSync(rootPath)) {
    fs.mkdirSync(rootPath, { recursive: true });
  }
  
  // 首先检查是否有设备连接
  exec('adb devices', (devicesError, devicesStdout, devicesStderr) => {
    if (devicesError) {
      statusBarItem.hide();
      vscode.window.showErrorMessage(`ADB命令执行失败: ${devicesError.message}`);
      return;
    }
    
    const deviceLines = devicesStdout.trim().split('\n').slice(1);
    const connectedDevices = deviceLines.filter(line => line.trim() && !line.includes('offline'));
    
    if (connectedDevices.length === 0) {
      statusBarItem.hide();
      vscode.window.showErrorMessage('没有已连接的Android设备，请先连接设备');
      return;
    }
    
    // 执行adb shell命令检查目录是否存在
    exec('adb shell ls /sdcard/android/data/com.tkeap.vfm/VFM_Hybrid/VFM_Hybrid_parameterLogs', (error, stdout, stderr) => {
      if (error) {
        statusBarItem.hide();
        vscode.window.showErrorMessage(`无法访问设备上的日志目录: ${error.message}`);
        return;
      }
      
      if (stderr && stderr.includes('No such file or directory')) {
        statusBarItem.hide();
        vscode.window.showErrorMessage('设备上不存在VFM日志目录，请确认应用是否正确运行');
        return;
      }
      
      if (!stdout.trim()) {
        statusBarItem.hide();
        vscode.window.showInformationMessage('设备上的VFM日志目录为空');
        return;
      }
      
      // 显示正在拉取的状态
      statusBarItem.text = `$(loading~spin) 正在拉取VFM日志文件...`;
      
      // 执行adb pull命令拉取整个目录
      exec('adb pull /sdcard/android/data/com.tkeap.vfm/VFM_Hybrid/VFM_Hybrid_parameterLogs "' + rootPath + '"', (pullError, pullStdout, pullStderr) => {
        statusBarItem.hide();
        
        if (pullError) {
          vscode.window.showErrorMessage(`拉取日志文件失败: ${pullError.message}`);
          return;
        }
        
        if (pullStderr && !pullStderr.includes('pulled')) {
          vscode.window.showErrorMessage(`拉取过程出现错误: ${pullStderr}`);
          return;
        }
        
        // 提取拉取的文件数量信息
        let fileCount = '多个';
        const pullMatch = pullStderr.match(/(\d+)\s+file[s]?\s+pulled/);
        if (pullMatch && pullMatch[1]) {
          fileCount = pullMatch[1];
        }
        
        vscode.window.showInformationMessage(`成功拉取 ${fileCount} 个VFM日志文件`);
        
        // 刷新文件浏览器视图
        refreshFileExplorer();
      });
    });
  });
});

export function deactivate() {}
