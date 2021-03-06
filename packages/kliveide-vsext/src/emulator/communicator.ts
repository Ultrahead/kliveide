import * as vscode from "vscode";
import fetch, { RequestInit, Response } from "node-fetch";
import { KLIVEIDE, EMU_PORT, SAVE_FOLDER } from "../config/sections";

/**
 * This class is responsible for communicating with the Klive Emulator
 */
class Communicator {
  /**
   * Gets the base URL used to communicate with Klive Emulator
   */
  url(): string {
    const config = vscode.workspace.getConfiguration(KLIVEIDE);
    const port = config.get(EMU_PORT);
    return `http://localhost:${port}`;
  }

  /**
   * Requests a hello message
   */
  async hello(): Promise<boolean> {
    let retryCount = 0;
    while (retryCount < 10) {
      // --- Get the hello response
      const hello = await this.getText("/hello");

      // --- The "KliveEmu" message signs that the emulator has been initialized.
      if (hello === "KliveEmu") {
        // --- The emulator started and initialized.
        return true;
      }

      // --- Let's wait while the emulator initializes itself
      await new Promise((r) => setTimeout(r, 200));
      retryCount++;
    }
    return false;
  }

  /**
   * Gets frame information from the virtual machine
   */
  async frameInfo(): Promise<FrameInfo> {
    return this.getJson<FrameInfo>("/frame-info");
  }

  /**
   * Gets Z80 register information from the virtual machine
   */
  async getRegisters(): Promise<RegisterData> {
    return this.getJson<RegisterData>("/z80-regs");
  }

  /**
   * Gets the contents of the specified memory segment
   * @param from Firts memory address
   * @param to Last memory address
   */
  async getMemory(from: number, to: number): Promise<string> {
    return this.getText(`/memory/${from}/${to}`);
  }

  /**
   * Gets the contents of the specified ROM page
   * @param page Page to get
   */
  async getRomPage(page: number): Promise<string> {
    return this.getText(`/rom/${page}`);
  }

  /**
   * Gets the contents of the specified BANK page
   * @param page Page to get
   */
  async getBankPage(page: number): Promise<string> {
    return this.getText(`/bank/${page}`);
  }

  /**
   * Sets the specified breakpoint
   * @param address Breakpoint address
   */
  async setBreakpoint(address: number): Promise<void> {
    await this.post("/breakpoints", { breakpoints: [ address ]});
  }

  /**
   * Sets the specified breakpoint
   * @param address Breakpoint address
   */
  async removeBreakpoint(address: number): Promise<void> {
    await this.post("/delete-breakpoints", { breakpoints: [ address ]});
  }

  /**
   * Notifies the emulator about IDE configuration changes
   * @param ideConfig IDE configuration
   */
  async signConfigurationChange(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders;
    const projectFolder = folders ? folders[0].uri.fsPath : "";
    const kliveConfig = vscode.workspace.getConfiguration(KLIVEIDE);
    const ideConfig: IdeConfiguration = {
      projectFolder,
      saveFolder: kliveConfig.get(SAVE_FOLDER) ?? ""
    };
    await this.post("/ide-config", ideConfig);
  }

  /**
   * Sends a tape file to the emulator
   * @param filename File name to send to the emulator
   */
  async setTapeFile(filename: string): Promise<boolean> {
    const response = await this.post("/tape-contents", { tapeFile: filename});
    return response.ok;
  }

  /**
   * Sets the ZX Spectrum machine type
   * @param typeId Machine type ID
   */
  async setMachineType(typeId: string): Promise<void> {
    await this.post("/machine-type", { type: typeId});
  }

  /**
   * Invokes a GET command for a generic response
   * @param command Command string
   * @param requestInit Optional request initialization
   */
  private async get(
    command: string,
    requestInit?: RequestInit
  ): Promise<Response> {
    if (!requestInit) {
      requestInit = {
        method: "GET",
        timeout: 1000,
      };
    }
    return await fetch(`${this.url()}${command}`, requestInit);
  }

  /**
   * Invokes a GET command for a text
   * @param command Command string
   * @param requestInit Optional request initialization
   */
  private async getText(
    command: string,
    requestInit?: RequestInit
  ): Promise<string> {
    const response = await this.get(command, requestInit);
    if (response.ok) {
      return response.text();
    }
    throw new Error(`Unexpected response for ${command}: ${response.status}`);
  }

  /**
   * Invokes a GET command for a JSON object
   * @param command Command string
   * @param requestInit Optional request initialization
   */
  private async getJson<T extends Object>(
    command: string,
    requestInit?: RequestInit
  ): Promise<T> {
    const response = await this.get(command, requestInit);
    if (response.ok) {
      return (await response.json()) as T;
    }
    throw new Error(`Unexpected response for ${command}: ${response.status}`);
  }

    /**
   * Invokes a GET command for a generic response
   * @param command Command string
   * @param requestInit Optional request initialization
   */
  private async post(
    command: string,
    body: object,
    requestInit?: RequestInit
  ): Promise<Response> {
    if (!requestInit) {
      requestInit = {
        method: "POST",
        timeout: 1000,
        headers: { "Content-Type": "application/json"},
        body: JSON.stringify(body)
      };
    }
    return await fetch(`${this.url()}${command}`, requestInit);
  }
}

/**
 * Defines the response for a frameInfo request
 */
export interface FrameInfo {
  startCount?: number;
  frameCount?: number;
  executionState?: number;
  breakpoints?: number[];
  pc?: number;
  runsInDebug?: boolean;
  machineType?: string;
  selectedRom?: number;
  selectedBank?: number;
}

/**
 * Represents the information about execution state change
 */
export interface ExecutionState {
  state: string,
  pc?: number,
  runsInDebug?: boolean
}

/**
 * Represents Z80 Registers data
 */
export interface RegisterData {
  af: number;
  bc: number;
  de: number;
  hl: number;
  af_: number;
  bc_: number;
  de_: number;
  hl_: number;
  pc: number;
  sp: number;
  ix: number;
  iy: number;
  i: number;
  r: number;
  wz: number;
}

/**
 * Represents the configuration data sent by the IDE
 */
export interface IdeConfiguration {
  /**
   * The absolute path of the current project folder
   */
  projectFolder: string;

  /**
   * The current SAVE folder
   */
  saveFolder: string;
}

/**
 * Information about current memory pages
 */
export interface MemoryPageInfo {
  /**
   * Selected ROM page
   */
  selectedRom: number;

  /**
   * Selected upper memory bank
   */
  selectedBank: number;
}

/**
 * The singleton communicator instance
 */
export const communicatorInstance = new Communicator();
