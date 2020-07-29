import { SpectNetAction, createAction } from "./redux-core";
import { EmulatorPanelState } from "./AppState";

export function emulatorSetSizeAction(width: number, height: number) {
  return createAction("EMULATOR_SET_SIZE", { width, height });
}

export function emulatorSetZoomAction(zoom: number) {
  return createAction("EMULATOR_SET_ZOOM", { zoom });
}

export function emulatorSetExecStateAction(executionState: number) {
  return createAction("EMULATOR_SET_EXEC_STATE", { executionState });
}

export function emulatorSetBreakpointAction(breakPoint: number) {
  return createAction("EMULATOR_SET_BREAKPOINT", { breakPoint });
}

/**
 * This reducer manages keyboard panel state changes
 * @param state Input state
 * @param action Action executed
 */
export function emulatorStateReducer(
  state: EmulatorPanelState = {
    zoom: 1,
  },
  { type, payload }: SpectNetAction
): EmulatorPanelState {
  switch (type) {
    case "EMULATOR_SET_SIZE":
      return { ...state, width: payload.width, height: payload.height };
    case "EMULATOR_SET_ZOOM":
      return { ...state, zoom: payload.zoom };
    case "EMULATOR_SET_EXEC_STATE":
      return { ...state, executionState: payload.executionState };
    case "EMULATOR_SET_BREAKPOINT":
      return { ...state, breakPoint: payload.breakPoint };
  }
  return state;
}
