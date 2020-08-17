import * as vscode from "vscode";
import { spawn } from "child_process";
import { KLIVEIDE, EMU_EXEC_PATH } from "../config/sections";
import { communicatorInstance } from "../emulator/communicator";

/**
 * This code starts the Klive Emulator if it is not already started yet
 */
export async function startEmulator(): Promise<void> {
  try {
    if (await communicatorInstance.hello()) {
      // --- The Klive instance is started and initialized
      return;
    }
  } catch (err) {
    // --- This error is intentionally ignored
  }

  // --- We need to apply this hack to run an Electron app from VS Code
  // --- Source: https://stackoverflow.com/questions/51428982/execute-an-electron-app-within-vscode-extension
  var spawn_env = JSON.parse(JSON.stringify(process.env));
  delete spawn_env.ATOM_SHELL_INTERNAL_RUN_AS_NODE;
  delete spawn_env.ELECTRON_RUN_AS_NODE;
  const config = vscode.workspace.getConfiguration(KLIVEIDE);
  const exePath = config.get(EMU_EXEC_PATH) as string;
  if (!exePath || exePath.trim() === "") {
    vscode.window.showErrorMessage(`The Klive Emulator path is empty. Please set it in Klive settings.`);
    return;
  }
  try {
    const proc = spawn(exePath, [], {
      env: spawn_env,
      detached: true,
    });
    if (proc.pid) {
      try {
        await communicatorInstance.hello();
        vscode.window.showInformationMessage("Klive Emulator successfuly started.");
      } catch (err) {
        vscode.window.showErrorMessage(`Cannot communicate with the executable on '${exePath}'.`);
      }
    } else {
      vscode.window.showErrorMessage(`The path '${exePath}' is not a valid path to Klive executable.`);
    }
  } catch (err) {
    vscode.window.showErrorMessage(`Klive Emulator: ${err}`);
  }
}
