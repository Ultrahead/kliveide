import * as vscode from "vscode";
import { startEmulator } from "./commands/start-emu";
import { Z80RegistersProvider } from "./views/z80-registers";
import { setZ80RegisterProvider } from "./providers";
import { startNotifier, stopNotifier } from "./emulator/notifier";
import { communicatorInstance } from "./emulator/communicator";
import { createVmStateStatusBarItem } from "./views/statusbar";
import { updateKliveProject } from "./commands/update-klive-project";
import { DisassemblyEditorProvider } from "./custom-editors/disassembly/disass-editor";
import { goToAddress } from "./commands/goto-address";
import { sendTapeFile } from "./commands/send-tape-file";
import { refreshView } from "./commands/refresh-view";
import { spectrumConfigurationInstance } from "./emulator/machine-config";
import { MemoryEditorProvider } from "./custom-editors/memory/memory-editor";
import { KLIVEIDE, SAVE_FOLDER } from "./config/sections";
import {
  startBackgroundDisassembly,
  stopBackgroundDisassembly,
} from "./custom-editors/disassembly/background-disassembly";
import { setExtensionContext } from "./extension-paths";
import { BasicEditorProvider } from "./custom-editors/basic/basic-editor";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient";

let client: LanguageClient;

export async function activate(context: vscode.ExtensionContext) {
  // --- We use the context in several places, save it
  setExtensionContext(context);

  console.log(context.asAbsolutePath("out/z80lang/server/server.js"));

  // --- Helper shortcuts
  const register = vscode.commands.registerCommand;
  const subs = context.subscriptions;

  // --- Initialize the machine from configuration
  spectrumConfigurationInstance.initialize();

  // --- Register extension commands
  subs.push(
    register("kliveide.startEmu", async () => await startEmulator()),
    register("kliveide.updateKliveProject", () => updateKliveProject(context)),
    register("kliveide.goToAddress", () => goToAddress()),
    register("kliveide.sendTape", (uri: vscode.Uri) => sendTapeFile(uri)),
    register("kliveide.refreshView", () => refreshView())
  );

  // --- Tree provider to display Z80 registers
  const z80RegistersProvider = new Z80RegistersProvider();
  setZ80RegisterProvider(z80RegistersProvider);
  vscode.window.registerTreeDataProvider("z80Registers", z80RegistersProvider);

  // --- Indicate the state of Klive Emulator in the status bar
  const vmStateItem = createVmStateStatusBarItem();
  vmStateItem.command = "kliveide.startEmu";
  context.subscriptions.push(vmStateItem);

  // --- Register custom editors
  context.subscriptions.push(DisassemblyEditorProvider.register(context));
  context.subscriptions.push(MemoryEditorProvider.register(context));
  context.subscriptions.push(BasicEditorProvider.register(context));

  // --- Send the current configuration to the emulator
  try {
    await communicatorInstance.signConfigurationChange();
  } catch (err) {
    // --- This error is intentionally ignored
  }

  // --- Observe configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (ev) => {
      if (ev.affectsConfiguration(`${KLIVEIDE}.${SAVE_FOLDER}`)) {
        try {
          await communicatorInstance.signConfigurationChange();
        } catch (err) {
          // --- This error is intentionally ignored
        }
      }
    })
  );

  // --- Start disassembly and caching
  startBackgroundDisassembly();

  // --- Start the notification mechanism
  startNotifier();

  setupZ80AsmLanguageClient(context);
}

function setupZ80AsmLanguageClient(context: vscode.ExtensionContext): void {
  // The server is implemented in node
  let serverModule = context.asAbsolutePath("./out/z80lang/languageServer/server.js");

  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  let debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  let serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  // Options to control the language client
  let clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: [{ scheme: "file", language: "z80asm" }],
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: vscode.workspace.createFileSystemWatcher("**/.clientrc"),
    },
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    "Z80AsmService",
    "Z80 ASM Language Server",
    serverOptions,
    clientOptions
  );

  // Start the client. This will also launch the server
  client.start();
}

/**
 * Stop watching for notifications
 */
export async function deactivate() {
  stopNotifier();
  await stopBackgroundDisassembly();
}
