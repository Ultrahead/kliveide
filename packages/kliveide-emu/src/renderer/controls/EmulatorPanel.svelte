<script>
  // ==========================================================================
  // The panel that displays the ZX Spectrum emulator with its overlays

  import { afterUpdate } from "svelte";
  import { createRendererProcessStateAware } from "../rendererProcessStore";
  import { emulatorSetZoomAction } from "../../shared/state/redux-emulator-state";
  import { pcKeyNames, currentKeyMappings } from "../spectrum/spectrum-keys";

  import ExecutionStateOverlay from "./ExecutionStateOverlay.svelte";
  import BeamOverlay from "./BeamOverlay.svelte";

  // --- The ZX Spectrum engine
  export let spectrum;

  // --- We need to be aware of state changes
  const stateAware = createRendererProcessStateAware("emulatorPanelState");

  // --- References to the HTML elements of this component
  let panelEl;
  let screenEl;
  let shadowScreenEl;

  // --- ZX Spectrum screen dimensions
  let screenWidth = 256;
  let screenHeight = 192;

  // --- Dimensions of the canvas displaying the ZX Spectrum screen
  let canvasWidth;
  let canvasHeight;

  // --- Dimensions of this panel
  let clientWidth;
  let clientHeight;

  // --- Buffers for holding screen data
  let imageBuffer;
  let imageBuffer8;
  let pixelData;

  // --- Text and visibility of execution status overlay
  let overlay = "No ZX Spectrum virtual machine type set";
  let overlayHidden = false;

  // --- Current execution state
  let execState;

  // --- Should the beam position be displayed?
  let showBeam;
  let tactsInFrame;
  let tactToDisplay;

  // --- Bounding renctangle information to display beam position
  let panelRectangle;
  let screenRectangle;
  let panelMessage;

  // --- Catch the state of beam position indicator visibility
  stateAware.stateChanged.on((state) => {
    showBeam = state.beamPosition;
    panelMessage = state.panelMessage;
  });

  // --- Set up the component when the ZX Spectrum engine changes
  $: {
    if (spectrum) {
      setupEmulator();
    }
  }

  // --- Respond to panel size changes
  $: {
    calculateDimensions(clientWidth, clientHeight, screenWidth, screenHeight);
  }

  // --- We need to update beam positions whenever the state has been updated
  afterUpdate(() => {
    if (showBeam) {
      calculateBoundariesForBeam();
    }
    if (execState) {
      displayScreenData();
    }
  });

  // --- Set up the emulator according to the current ZX Spectrum machine
  async function setupEmulator() {
    overlay = "Not started yet";
    hideDisplayData();

    // --- Refresh the screen when there's a new frame
    spectrum.screenRefreshed.on(() => displayScreenData());

    // --- Change the execution state overlay text on change
    spectrum.executionStateChanged.on((arg) => {
      execState = arg.newState;
      switch (arg.newState) {
        case 1:
          overlay = arg.isDebug ? "Debug mode" : "";
          break;
        case 3:
          overlay = "Paused";
          const state = spectrum.getMachineState();
          tactsInFrame = state.tactsInFrame;
          tactToDisplay = state.lastRenderedUlaTact % tactsInFrame;
          displayScreenData();
          break;
        case 5:
          overlay = "Stopped";
          break;
        default:
          overlay = "";
          break;
      }
    });

    // --- Calculate the initial dimensions
    screenWidth = spectrum.screenWidth;
    screenHeight = spectrum.screenHeight;
    calculateDimensions(clientWidth, clientHeight, screenWidth, screenHeight);
    calculateBoundariesForBeam();

    // --- Prepare displayiong the screen and playing the sound
    configureScreen();
    configureSound();
  }

  // --- Calculates boundaries for the beam position
  function calculateBoundariesForBeam() {
    if (!screenEl) return;

    screenRectangle = screenEl.getBoundingClientRect();
    panelRectangle = panelEl.getBoundingClientRect();
  }

  // --- Setup the screen buffers
  function configureScreen() {
    const dataLen = screenWidth * screenHeight * 4;
    imageBuffer = new ArrayBuffer(dataLen);
    imageBuffer8 = new Uint8Array(imageBuffer);
    pixelData = new Uint32Array(imageBuffer);
  }

  // --- Setup the audio sample rate
  function configureSound() {
    const audioCtx = new AudioContext();
    const sampleRate = audioCtx.sampleRate;
    audioCtx.close();
    if (spectrum) {
      spectrum.setAudioSampleRate(sampleRate);
    }
  }

  // --- Calculate the dimensions so that the ZX Spectrum display fits the screen
  function calculateDimensions(clientWidth, clientHeight, width, height) {
    let widthRatio = Math.floor((clientWidth - 8) / width);
    if (widthRatio < 1) widthRatio = 1;
    let heightRatio = Math.floor((clientHeight - 8) / height);
    if (heightRatio < 1) heightRatio = 1;
    const ratio = Math.min(widthRatio, heightRatio);
    canvasWidth = width * ratio;
    canvasHeight = height * ratio;

    if (!shadowScreenEl || !screenEl) return;
    shadowScreenEl.width = width;
    shadowScreenEl.height = height;
    const shadowCtx = shadowScreenEl.getContext("2d");
    if (shadowCtx) {
      shadowCtx.canvas.width = width;
      shadowCtx.canvas.height = height;
    }
    const screenCtx = screenEl.getContext("2d");
    if (screenCtx) {
      screenCtx.canvas.width = width * ratio;
      screenCtx.canvas.height = height * ratio;
    }
  }

  // --- Displays the ZX Spectrum screen
  function displayScreenData() {
    // --- Do not refresh after stopped state
    if (!execState || execState === 5) return;

    const shadowCtx = shadowScreenEl.getContext("2d");
    if (!shadowCtx) return;
    const shadowImageData = shadowCtx.getImageData(
      0,
      0,
      shadowScreenEl.width,
      shadowScreenEl.height
    );
    const screenCtx = screenEl.getContext("2d");
    let j = 0;

    const screenData = spectrum.getScreenData();
    for (let i = 0; i < screenWidth * screenHeight; i++) {
      pixelData[j++] = screenData[i];
    }
    shadowImageData.data.set(imageBuffer8);
    shadowCtx.putImageData(shadowImageData, 0, 0);
    if (screenCtx) {
      screenCtx.imageSmoothingEnabled = false;
      screenCtx.drawImage(
        shadowScreenEl,
        0,
        0,
        screenEl.width,
        screenEl.height
      );
    }
  }

  // --- Hide the display
  function hideDisplayData() {
    if (!screenEl) return;

    const screenCtx = screenEl.getContext("2d");
    if (screenCtx) {
      screenCtx.clearRect(0, 0, screenEl.width, screenEl.height);
    }
  }

  // --- Handles key presses
  function handleKey(e, status) {
    const key = pcKeyNames.get(e.code);
    if (!key) return;
    const mapping = currentKeyMappings.get(key);
    if (mapping) {
      spectrum.setKeyStatus(mapping.zxPrimary, status);
      if (mapping.zxSecondary) {
        spectrum.setKeyStatus(mapping.zxSecondary, status);
      }
    }
  }
</script>

<style>
  .emulator-panel {
    display: flex;
    overflow: hidden;
    flex-shrink: 1;
    flex-grow: 1;
    height: 100%;
    width: 100%;
    /*padding: 8px 12px; */
    background-color: var(--emulator-background-color);
    box-sizing: border-box;
    justify-content: center;
    align-items: center;
    outline: none;
  }

  .emulator-screen {
    background-color: #404040;
  }
</style>

<svelte:window
  on:keydown={(e) => handleKey(e, true)}
  on:keyup={(e) => handleKey(e, false)} />
<div
  tabindex="-1"
  class="emulator-panel"
  bind:clientWidth
  bind:clientHeight
  bind:this={panelEl}>
  <div
    class="emulator-screen"
    style={`width:${canvasWidth}px; height:${canvasHeight}px`}
    on:click={() => (overlayHidden = false)}>
    {#if execState === 3 && showBeam}
      <BeamOverlay
        {panelRectangle}
        {screenRectangle}
        width={clientWidth}
        height={clientHeight}
        {tactToDisplay} />
    {/if}
    {#if !overlayHidden}
      <ExecutionStateOverlay
        text={panelMessage ? panelMessage : overlay}
        on:hide={() => (overlayHidden = true)} />
    {/if}
    <canvas bind:this={screenEl} />
    <canvas bind:this={shadowScreenEl} style="display:none" />
  </div>
</div>
