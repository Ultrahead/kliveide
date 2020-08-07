import * as expect from "expect";
import {
  MemoryMap,
  MemorySection,
  SpectrumSpecificDisassemblyFlags,
  intToX2,
} from "../../src/disassembler/disassembly-helper";
import { Z80Disassembler } from "../../src/disassembler/z80-disassembler";

/**
 * Helper class for Z80 Disassembler testing
 */
export class Z80Tester {
  /**
   * Tests if Z80 instruction disassembly works
   * @param expected Expected disassembly text
   * @param opCodes Operation codes
   */
  static async Test(expected: string, ...opCodes: number[]): Promise<void> {
    const map = new MemoryMap();
    map.add(new MemorySection(0x0000, opCodes.length - 1));

    const disassembler = new Z80Disassembler(
      map.sections,
      new Uint8Array(opCodes)
    );
    var output = await disassembler.disassemble();
    expect(output.outputItems.length).toBe(1);
    const item = output.outputItems[0];
    expect(item.instruction).toBeTruthy();
    if (!item.instruction) {
      return;
    }
    expect(item.instruction.toLowerCase()).toBe(expected.toLowerCase());
    expect(item.lastAddress).toBe(opCodes.length - 1);
    expect(item.opCodes.trim()).toBe(this._joinOpCodes(opCodes));
  }

  /**
   * Tests if Z80 extended instruction set disassembly works
   * @param expected Expected disassembly text
   * @param opCodes Operation codes
   */
  static async TestExt(expected: string, ...opCodes: number[]): Promise<void> {
    const map = new MemoryMap();
    map.add(new MemorySection(0x0000, opCodes.length - 1));

    const disassembler = new Z80Disassembler(
      map.sections,
      new Uint8Array(opCodes),
      undefined,
      true
    );
    var output = await disassembler.disassemble();
    expect(output.outputItems.length).toBe(1);
    const item = output.outputItems[0];
    expect(item.instruction).toBeTruthy();
    if (!item.instruction) {
      return;
    }
    expect(item.instruction.toLowerCase()).toBe(expected.toLowerCase());
    expect(item.lastAddress).toBe(opCodes.length - 1);
    expect(item.opCodes.trim()).toBe(this._joinOpCodes(opCodes));
  }

  static async TestZx(
    flags: SpectrumSpecificDisassemblyFlags,
    expected: string[],
    ...opCodes: number[]
  ): Promise<void> {
    const map = new MemoryMap();
    map.add(new MemorySection(0x0000, opCodes.length - 1));
    const disasmFlags = new Map<number, SpectrumSpecificDisassemblyFlags>();
    disasmFlags.set(0, flags);
    const disassembler = new Z80Disassembler(
      map.sections,
      new Uint8Array(opCodes),
      disasmFlags
    );
    var output = await disassembler.disassemble();
    expect(output.outputItems.length).toBe(expected.length);
    for (let i = 0; i < expected.length; i++) {
      const instr = output.outputItems[i].instruction;
      expect(instr).toBeTruthy();
      if (!instr) {
        continue;
      }
      expect(instr.toLowerCase()).toBe(expected[i]);
    }
  }

  /**
   * Joins the opcodes into a string
   * @param opCodes Opecration codes
   */
  private static _joinOpCodes(opCodes: number[]): string {
    let result = "";
    for (let i = 0; i < opCodes.length; i++) {
      if (i > 0) {
        result += " ";
      }
      result += intToX2(opCodes[i]);
    }
    return result;
  }
}