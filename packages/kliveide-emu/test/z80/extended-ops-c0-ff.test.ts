import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import * as path from "path";
import { CpuApi } from "../../src/native/api/api";
import { TestZ80Machine } from "../../src/native/api/TestZ80Machine";
import { importObject } from "../import-object";

const buffer = fs.readFileSync(path.join(__dirname, "../../build/spectrum.wasm"));
let api: CpuApi;
let testMachine: TestZ80Machine;

describe("Extended ops c0-ff", () => {
  before(async () => {
    const wasm = await WebAssembly.instantiate(buffer, importObject);
    api = (wasm.instance.exports as unknown) as CpuApi;
    testMachine = new TestZ80Machine(api);
  });

  beforeEach(() => {
    testMachine.reset();
  });

  for (let i = 0xc0; i <= 0xff; i++) {
    it(`${i.toString(16)}: nop`, () => {
      let s = testMachine.initCode([0xed, i]);

      s = testMachine.run();

      testMachine.shouldKeepRegisters();
      testMachine.shouldKeepMemory();
      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }
});
