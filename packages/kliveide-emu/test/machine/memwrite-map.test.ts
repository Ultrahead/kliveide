import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import * as path from "path";
import { MachineApi } from "../../src/native/api/api";
import { ZxSpectrum48 } from "../../src/native/api/ZxSpectrum48";
import { MemoryHelper } from "../../src/native/api/memory-helpers";
import { importObject } from "../import-object";
import { MEMWRITE_MAP } from "../../src/native/api/memory-map";

const buffer = fs.readFileSync(
  path.join(__dirname, "../../build/spectrum.wasm")
);
let api: MachineApi;
let machine: ZxSpectrum48;

describe("ZX Spectrum - Memory write map", () => {
  before(async () => {
    const wasm = await WebAssembly.instantiate(buffer, importObject);
    api = (wasm.instance.exports as unknown) as MachineApi;
    machine = new ZxSpectrum48(api);
  });

  beforeEach(() => {
    machine.reset();
  });

  it("eraseMemoryWriteMap works", () => {
    api.eraseMemoryWriteMap();

    for (let i = 0; i < 1000; i++) {
      api.setBreakpoint(i * 4);
    }

    api.eraseBreakpoints();

    const mh = new MemoryHelper(api, MEMWRITE_MAP);
    const brMap = mh.readBytes(0, 0x2000);
    let sum = 0;
    for (let i = 0; i < brMap.length; i++) {
      sum += brMap[i];
    }

    expect(sum).toBe(0);
  });

  it("setMemoryWritePoint works", () => {
    api.eraseMemoryWriteMap();

    for (let i = 0; i < 100; i++) {
      api.setMemoryWritePoint(i * 4);
    }

    const mh = new MemoryHelper(api, MEMWRITE_MAP);
    const brMap = mh.readBytes(0, 0x2000);
    let sum = 0;
    for (let i = 0; i < brMap.length; i++) {
      sum += brMap[i];
    }
    expect(sum).toBe(850);
  });

});
