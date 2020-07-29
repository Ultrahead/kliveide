import { ZxSpectrumBase } from "../../native/ZxSpectrumBase";
import {
  ExecutionState,
  ExecutionStateChangedArgs,
} from "../../shared/spectrum/execution-state";
import { ILiteEvent, LiteEvent } from "../../shared/utils/LiteEvent";
import {
  ExecuteCycleOptions,
  ExecutionCompletionReason,
  SpectrumMachineState,
  EmulationMode,
  DebugStepMode,
} from "../../native/machine-state";
import { SpectrumKeyCode } from "../../native/SpectrumKeyCode";
import { EmulatedKeyStroke } from "./spectrum-keys";
import { MemoryHelper } from "../../native/memory-helpers";
import { AudioRenderer } from "./AudioRenderer";
import { rendererProcessStore } from "../rendererProcessStore";
import { emulatorSetExecStateAction } from "../../shared/state/redux-emulator-state";
import { getDefaultTapeSet, setZ80Memory } from "../../shared/messaging/message-senders";
import { BinaryReader } from "../../shared/utils/BinaryReader";
import { TzxReader } from "../../shared/tape/tzx-file";

/**
 * Beeper samples in the memory
 */
const BEEPER_SAMPLE_BUFF = 0x0b_2200;

/**
 * Beeper samples in the memory
 */
const EXEC_STAT_TABLE = 0x1f_4300;

/**
 * This class represents the engine of the ZX Spectrum,
 * which runs within the main process.
 */
export class SpectrumEngine {
  private _vmState: ExecutionState = ExecutionState.None;
  private _isFirstStart: boolean = false;
  private _isFirstPause: boolean = false;
  private _executionCycleError: Error | undefined;
  private _cancelled: boolean = false;
  private _justRestoredState: boolean = false;

  private _executionStateChanged = new LiteEvent<ExecutionStateChangedArgs>();
  private _screenRefreshed = new LiteEvent<void>();
  private _vmStoppedWithError = new LiteEvent<void>();
  private _beeperSamplesEmitted = new LiteEvent<number[]>();

  private _completionTask: Promise<void> | undefined;

  // --- The last loaded machine state
  private _loadedState: SpectrumMachineState;

  // --- Keyboard emulation
  private _keyStrokeQueue: EmulatedKeyStroke[] = [];

  // --- Beeper emulation
  private _beeperRenderer: AudioRenderer | null = null;

  // --- Tape emulation
  private _defaultTapeSet = new Uint8Array(0);

  /**
   * Initializes the engine with the specified ZX Spectrum instance
   * @param spectrum Spectrum VM to use
   */
  constructor(public spectrum: ZxSpectrumBase) {
    this._loadedState = spectrum.getMachineState();
  }

  /**
   * Number of frame tacts
   */
  get tactsInFrame(): number {
    return this._loadedState.tactsInFrame;
  }

  /**
   * Width of the screen
   */
  get screenWidth(): number {
    return this._loadedState.screenWidth;
  }

  /**
   * Height of the screen
   */
  get screenHeight(): number {
    return this._loadedState.screenLines;
  }

  /**
   * The current state of the virtual machine
   */
  get executionState(): ExecutionState {
    return this._vmState;
  }
  set executionState(newState: ExecutionState) {
    const oldState = this._vmState;
    this._vmState = newState;
    this._executionStateChanged.fire(
      new ExecutionStateChangedArgs(oldState, newState)
    );
  }

  /**
   * Signs that this is the very first start of the
   * virtual machine
   */
  get isFirstStart(): boolean {
    return this._isFirstStart;
  }

  /**
   * Signs that this is the very first paused state
   * of the virtual machine
   */
  get isFirstPause(): boolean {
    return this._isFirstPause;
  }

  /**
   * Exception that has been raised during the execution
   */
  get executionCycleError(): Error | undefined {
    return this._executionCycleError;
  }

  /**
   * Has the execution been cancelled?
   */
  get cancelled(): boolean {
    return this._cancelled;
  }

  /**
   * Indicates if machine state has just been restored.
   */
  get justRestoredState(): boolean {
    return this._justRestoredState;
  }

  /**
   * This event is raised whenever the state of the virtual machine changes
   */
  get executionStateChanged(): ILiteEvent<ExecutionStateChangedArgs> {
    return this._executionStateChanged.expose();
  }

  /**
   * This event is raised when the screen of the virtual machine has
   * been refreshed
   */
  get screenRefreshed(): ILiteEvent<void> {
    return this._screenRefreshed.expose();
  }

  /**
   * This event is raised when a new beeper sample frame is emitted
   */
  get beeperSamplesEmitted(): ILiteEvent<number[]> {
    return this._beeperSamplesEmitted.expose();
  }

  /**
   * This event is raised when the engine stops because of an exception
   */
  get stoppedWithError(): ILiteEvent<void> {
    return this._vmStoppedWithError.expose();
  }

  /**
   * Gets the promise that represents completion
   */
  get completionTask(): Promise<void> | undefined {
    return this._completionTask;
  }

  /**
   * Gets the state of the ZX Spectrum machine
   */
  getMachineState(): SpectrumMachineState {
    return this._loadedState;
  }

  /**
   * Sets the status of the specified ZX Spectrum key
   * @param key Code of the key
   * @param isDown Pressed/released status of the key
   */
  setKeyStatus(key: SpectrumKeyCode, isDown: boolean): void {
    this.spectrum.setKeyStatus(key, isDown);
  }

  /**
   * Sets the audio sample rate to use with sound devices
   * @param rate Audio sampe rate to use
   */
  setAudioSampleRate(rate: number): void {
    this.spectrum.setBeeperSampleRate(rate);
  }

  /**
   * Gets the screen pixels data to display
   */
  getScreenData(): Uint32Array {
    return this.spectrum.getScreenData();
  }

  /**
   * Puts a keystroke into the queue of emulated keystrokes
   * @param startFrame Start frame when the key is pressed
   * @param frames End frame when the key is released
   * @param primary Primary key
   * @param secodary Optional secondary key
   */
  queueKeyStroke(
    startFrame: number,
    frames: number,
    primaryKey: SpectrumKeyCode,
    secondaryKey?: SpectrumKeyCode
  ): void {
    this._keyStrokeQueue.push({
      startFrame,
      endFrame: startFrame + frames,
      primaryKey,
      secondaryKey,
    });
  }

  /**
   * Sets the breakpoint to stop at
   * @param brpoint Breakpoint value
   */
  setBreakpoint(brpoint: number): void {
    this.spectrum.api.setBreakpoint(brpoint);
  }

  /**
   * Dumps out the 64K memory visible be the CPU
   */
  dumpMemory(): string {
    // --- Dump memory
    const mh = new MemoryHelper(this.spectrum.api, 0);
    let dump = "";
    for (let i = 0; i < 0x10000; i += 0x10) {
      dump += toHexa(i, 4) + " ";
      for (let j = i; j <= i + 0x10; j++) {
        dump += toHexa(mh.readByte(j), 2) + " ";
      }
      dump += "\r\n";
    }

    // --- Dump registers
    dump += "\r\n";

    const s = this.getMachineState();
    dump += `AF:  ${toHexa(s.af, 4)}\r\n`;
    dump += `BC:  ${toHexa(s.bc, 4)}\r\n`;
    dump += `DE:  ${toHexa(s.de, 4)}\r\n`;
    dump += `HL:  ${toHexa(s.hl, 4)}\r\n`;
    dump += `AF': ${toHexa(s._af_, 4)}\r\n`;
    dump += `BC': ${toHexa(s._bc_, 4)}\r\n`;
    dump += `DE': ${toHexa(s._de_, 4)}\r\n`;
    dump += `HL': ${toHexa(s._hl_, 4)}\r\n`;
    dump += `PC:  ${toHexa(s.pc, 4)}\r\n`;
    dump += `SP:  ${toHexa(s.sp, 4)}\r\n`;
    dump += `IX:  ${toHexa(s.ix, 4)}\r\n`;
    dump += `IY:  ${toHexa(s.iy, 4)}\r\n`;
    dump += `WZ:  ${toHexa(s.wz, 4)}\r\n`;
    dump += `I:  ${toHexa(s.i, 2)}\r\n`;
    dump += `R:  ${toHexa(s.r, 2)}\r\n`;

    // --- Dump Stack Top
    dump += "\r\nStack:\r\n";
    for (let i = 0; i < 8; i++) {
      dump += `${i}:  (${toHexa(mh.readUint16(s.sp + 2 * i), 4)})\r\n`;
    }

    return dump;

    function toHexa(input: number, digits: number): string {
      return input.toString(16).toUpperCase().padStart(digits, "0");
    }
  }

  /**
   * Starts the virtual machine and keeps it running
   */
  async start(): Promise<void> {
    await this.run(new ExecuteCycleOptions());
  }

  /**
   * Starts the virtual machine in debugging mode
   */
  async startDebugging(): Promise<void> {
    await this.run(
      new ExecuteCycleOptions(
        EmulationMode.Debugger,
        DebugStepMode.StopAtBreakpoint
      )
    );
  }

  /**
   * Starts the virtual machine with the specified exeution options
   * @param options Execution options
   */
  async run(options: ExecuteCycleOptions): Promise<void> {
    if (this.executionState === ExecutionState.Running) {
      return;
    }

    // // --- Reset execution statistics
    // const mh = new MemoryHelper(this.spectrum.api, EXEC_STAT_TABLE);
    // for (let i = 0; i < 0x700; i++) {
    //   mh.writeUint32(i * 4, 0);
    // }

    // --- Set breakpoints
    const state = rendererProcessStore.getState().emulatorPanelState;
    if (state.breakPoint) {
      this.setBreakpoint(state.breakPoint);
      console.log(`Breakpoint set: 0x${state.breakPoint.toString(16)}`);
    } else {
      console.log("No breakpoints.")
    }

    // --- Prepare the machine to run
    this._isFirstStart =
      this.executionState === ExecutionState.None ||
      this.executionState === ExecutionState.Stopped;
    if (this._isFirstStart) {
      this.spectrum.reset();
      this._defaultTapeSet = (await getDefaultTapeSet()).bytes;
      const binaryReader = new BinaryReader(this._defaultTapeSet);
      const tzxReader = new TzxReader(binaryReader);
      if (tzxReader.readContents()) {
        console.log("Default tape file read.");
        const blocks = tzxReader.sendTapeFileToEngine(this.spectrum.api);
        this.spectrum.api.initTape(blocks);
      }
    }

    // --- Execute a single cycle
    this.executionState = ExecutionState.Running;
    rendererProcessStore.dispatch(
      emulatorSetExecStateAction(this.executionState)()
    );
    this._cancelled = false;
    this._completionTask = this.executeCycle(this, options);
  }

  /**
   * Pauses the running machine.
   */
  async pause(): Promise<void> {
    if (
      this.executionState === ExecutionState.None ||
      this.executionState === ExecutionState.Stopped ||
      this.executionState === ExecutionState.Paused
    ) {
      // --- Nothing to pause
      return;
    }

    if (!this._completionTask) {
      // --- No completion to wait for
      return;
    }

    // --- Prepare the machine to pause
    this.executionState = ExecutionState.Pausing;
    rendererProcessStore.dispatch(
      emulatorSetExecStateAction(this.executionState)()
    );
    this._isFirstPause = this._isFirstStart;
    this.cancelRun();
    this.executionState = ExecutionState.Paused;
    rendererProcessStore.dispatch(
      emulatorSetExecStateAction(this.executionState)()
    );
    await setZ80Memory(this.dumpMemory());

    // --- Diagnostics
    // const mh = new MemoryHelper(this.spectrum.api, 0);
    // let sum = 0;
    // for (let i = 0; i < 0x200; i++) {
    //   sum += mh.readByte(i + 0x64c0 + 0x200);
    // }
    // console.log(`PG_ATTRS: ${sum}`);
    // sum = 0;
    // for (let i = 0; i < 0x100; i++) {
    //   sum += mh.readByte(i + 0x5800 + 0x200);
    // }
    // console.log(`SCR_ATTRS: ${sum}`);

    // console.log("Standard Ops")
    // for (let i = 0; i < 0x100; i++) {
    //   const opCount = mh.readUint32(i * 4);
    //   if (opCount === 0) {
    //     console.log(`0x${i.toString(16)}: not used.`);
    //   }
    // }
    // console.log("IX Ops")
    // for (let i = 0; i < 0x100; i++) {
    //   const opCount = mh.readUint32(i * 4 + 3*1024);
    //   if (opCount !== 0) {
    //     console.log(`0x${i.toString(16)}: used.`);
    //   }
    // }
    // console.log("IY Ops")
    // for (let i = 0; i < 0x100; i++) {
    //   const opCount = mh.readUint32(i * 4 + 4*1024);
    //   if (opCount !== 0) {
    //     console.log(`0x${i.toString(16)}: used.`);
    //   }
    // }
    // console.log("Extended Ops")
    // for (let i = 0; i < 0x100; i++) {
    //   const opCount = mh.readUint32(i * 4 + 1*1024);
    //   if (opCount !== 0) {
    //     console.log(`0x${i.toString(16)}: used.`);
    //   }
    // }
  }

  async stop(): Promise<void> {
    // --- Stop only running machine
    switch (this._vmState) {
      case ExecutionState.None:
      case ExecutionState.Stopped:
        return;

      case ExecutionState.Paused:
        // --- The machine is paused, it can be quicky stopped
        this.executionState = ExecutionState.Stopping;
        rendererProcessStore.dispatch(
          emulatorSetExecStateAction(this.executionState)()
        );
        this.executionState = ExecutionState.Stopped;
        rendererProcessStore.dispatch(
          emulatorSetExecStateAction(this.executionState)()
        );
        break;

      default:
        // --- Initiate stop
        this.executionState = ExecutionState.Stopping;
        rendererProcessStore.dispatch(
          emulatorSetExecStateAction(this.executionState)()
        );
        this.cancelRun();
        this.executionState = ExecutionState.Stopped;
        rendererProcessStore.dispatch(
          emulatorSetExecStateAction(this.executionState)()
        );
        break;
    }
  }

  /**
   * Cancels the execution cycle
   */
  async cancelRun(): Promise<void> {
    this._cancelled = true;
    await this._completionTask;
    if (this._beeperRenderer) {
      this._beeperRenderer.closeAudio();
      this._beeperRenderer = null;
    }
  }

  /**
   * Executes the cycle of the Spectrum virtual machine
   * @param machine The virtual machine
   * @param options Execution options
   */
  async executeCycle(
    machine: SpectrumEngine,
    options: ExecuteCycleOptions
  ): Promise<void> {
    const state = machine.spectrum.getMachineState();
    // --- Store the start time of the frame
    const clockFreq = state.baseClockFrequency * state.clockMultiplier;
    const nextFrameGap = (state.tactsInFrame / clockFreq) * 1000;
    let nextFrameTime = performance.now() + nextFrameGap;

    //

    // --- Execute the cycle until completed
    while (true) {
      machine.spectrum.executeCycle(options);

      // --- Check for user cancellation
      if (this._cancelled) return;

      const resultState = (this._loadedState = machine.spectrum.getMachineState());
      const reason = resultState.executionCompletionReason;
      if (reason !== ExecutionCompletionReason.UlaFrameCompleted) {
        // --- No more frame to execute
        if (
          reason === ExecutionCompletionReason.BreakpointReached ||
          reason === ExecutionCompletionReason.TerminationPointReached
        ) {
          machine.executionState = ExecutionState.Paused;
          await setZ80Memory(this.dumpMemory());
        }

        // --- Stop audio
        if (this._beeperRenderer) {
          this._beeperRenderer.closeAudio();
          this._beeperRenderer = null;
        }
        return;
      }

      // --- Handle key strokes
      this.emulateKeyStroke(resultState.frameCount);

      // --- At this point we have not completed the execution yet
      // --- Initiate the refresh of the screen
      machine.spectrum.api.colorize();
      machine._screenRefreshed.fire();

      // --- Obtain beeper samples
      if (!this._beeperRenderer) {
        this._beeperRenderer = new AudioRenderer(
          resultState.beeperSampleLength
        );
      }
      const mh = new MemoryHelper(this.spectrum.api, BEEPER_SAMPLE_BUFF);
      if (resultState.beeperSampleCount === 0) {
        console.log("0 beeper samples detected!");
      }
      const beeperSamples = mh.readBytes(0, resultState.beeperSampleCount);
      this._beeperRenderer.storeSamples(beeperSamples);
      machine._beeperSamplesEmitted.fire(beeperSamples);

      // --- Wait for the next screen frame
      const curTime = performance.now();
      const toWait = Math.floor(nextFrameTime - curTime);
      await delay(toWait - 2);
      nextFrameTime += nextFrameGap;
    }

    /**
     * Delay for the specified amount of milliseconds
     * @param milliseconds Amount of milliseconds to delay
     */
    function delay(milliseconds: number): Promise<void> {
      return new Promise<void>((resolve) => {
        if (milliseconds < 0) {
          milliseconds = 0;
        }
        setTimeout(() => {
          resolve();
        }, milliseconds);
      });
    }
  }

  /**
   * Emulates the next keystroke waiting in the queue
   * @param frame Current screen frame
   */
  emulateKeyStroke(frame: number): void {
    if (this._keyStrokeQueue.length === 0) return;
    const nextKey = this._keyStrokeQueue[0];
    if (nextKey.startFrame > frame) return;

    // --- Handle the active key in the queue
    if (nextKey.endFrame <= frame) {
      // --- Release the key
      this.setKeyStatus(nextKey.primaryKey, false);
      if (nextKey.secondaryKey !== undefined) {
        this.setKeyStatus(nextKey.secondaryKey, false);
      }
      this._keyStrokeQueue.shift();
      return;
    }

    // --- Press the key
    this.setKeyStatus(nextKey.primaryKey, true);
    if (nextKey.secondaryKey !== undefined) {
      this.setKeyStatus(nextKey.secondaryKey, true);
    }
  }

  /**
   * Gets the cursor mode of ZX Spectrum
   */
  getCursorMode(): number {
    return this.spectrum.api.getCursorMode();
  }

  /**
   * Gets the length of the keyboard queue
   */
  getKeyQueueLength(): number {
    return this._keyStrokeQueue.length;
  }
}
