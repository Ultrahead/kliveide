import { RegisterData } from "../spectrum/api-data";
import { IdeConfiguration, MemoryCommand } from "./AppState";

/**
 * This interface represents the shape of the payload
 */
export interface Payload {
  width?: number;
  height?: number;
  zoom?: number;
  executionState?: number;
  runsInDebug?: boolean;
  tapeContents?: Uint8Array;
  tapeLoaded?: boolean;
  shadowScreen?: boolean;
  beamPosition?: boolean;
  fastLoad?: boolean;
  isLoading?: boolean;
  command?: string;
  startCount?: number;
  frameCount?: number;
  muted?: boolean;
  registers?: RegisterData;
  from?: number;
  to?: number;
  memoryContents?: Uint8Array;
  memWriteMap?: Uint8Array;
  breakpoints?: number[];
  savedData?: Uint8Array;
  ideConfiguration?: IdeConfiguration;
  requestedType?: string;
  currentType?: string;
  connected?: boolean;
  selectedRom?: number;
  selectedBank?: number;
  index?: number;
  memoryCommandResult?: Uint8Array;
  seqNo?: number;
  panelMessage?: string;
}
