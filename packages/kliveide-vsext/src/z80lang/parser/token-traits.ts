import { TokenType } from "./token-stream";

/**
 * Contains traits of a particular token type
 */
export interface TokenTraits {
  /**
   * This token is an instruction
   */
  instruction?: boolean;

  /**
   * Indicates if an instruction is simple (argumentless)
   */
  simple?: boolean;

  /**
   * This token is a pragma
   */
  pragma?: boolean;

  /**
   * This token is a statement;
   */
  statement?: boolean;

  /**
   * This token is a directive
   */
  directive?: boolean;

  /**
   * This token can be the start of an expression
   */
  expressionStart?: boolean;

  /**
   * Represents a built-in function?
   */
  builtInFunction?: boolean;

  /**
   * Represents a literal?
   */
  literal?: boolean;

  /**
   * Represents a register?
   */
  reg?: boolean;

  /**
   * Represents a standard 8-bit register?
   */
  reg8?: boolean;

  /**
   * Represenst a special 8-bit register?
   */
  reg8Spec?: boolean;

  /**
   * Represents an 8-bit index register?
   */
  reg8Idx?: boolean;

  /**
   * Represents an 16-bit register?
   */
  reg16?: boolean;

  /**
   * Represents an 16-bit special register?
   */
  reg16Spec?: boolean;

  /**
   * Represents an 16-bit index register?
   */
  reg16Idx?: boolean;

  /**
   * Represents a condition value?
   */
  condition?: boolean;

  /**
   * Represents a JR condition value?
   */
  relCondition?: boolean;
}

/**
 * Gets the traits of the specified token type
 * @param type Token type
 */
export function getTokenTraits(type: TokenType): TokenTraits {
  return tokenTraits.get(type) ?? {};
}

/**
 * This map contains the traits of token types
 */
const tokenTraits = new Map<TokenType, TokenTraits>();

// ----------------------------------------------------------------------------
// A
tokenTraits.set(TokenType.A, { reg: true, reg8: true });
tokenTraits.set(TokenType.AF, { reg: true, reg16Spec: true });
tokenTraits.set(TokenType.AF_, { reg: true, reg16Spec: true });
tokenTraits.set(TokenType.Adc, { instruction: true });
tokenTraits.set(TokenType.Add, { instruction: true });
tokenTraits.set(TokenType.AlignPragma, { pragma: true });
tokenTraits.set(TokenType.Ampersand, {});
tokenTraits.set(TokenType.And, { instruction: true });
tokenTraits.set(TokenType.Assign, { pragma: true });

// ----------------------------------------------------------------------------
// B
tokenTraits.set(TokenType.B, { reg: true, reg8: true });
tokenTraits.set(TokenType.BankPragma, { pragma: true });
tokenTraits.set(TokenType.BC, { reg: true, reg16: true });
tokenTraits.set(TokenType.BinaryLiteral, {
  expressionStart: true,
  literal: true,
});
tokenTraits.set(TokenType.BinaryNot, { expressionStart: true });
tokenTraits.set(TokenType.Bit, { instruction: true });
tokenTraits.set(TokenType.Break, { statement: true });
tokenTraits.set(TokenType.Brlc, { instruction: true });
tokenTraits.set(TokenType.Bsla, { instruction: true });
tokenTraits.set(TokenType.Bsra, { instruction: true });
tokenTraits.set(TokenType.Bsrf, { instruction: true });
tokenTraits.set(TokenType.Bsrl, { instruction: true });

// ----------------------------------------------------------------------------
// C
tokenTraits.set(TokenType.C, {
  reg: true,
  reg8: true,
  condition: true,
  relCondition: true,
});
tokenTraits.set(TokenType.Call, { instruction: true });
tokenTraits.set(TokenType.Ccf, { instruction: true, simple: true });
tokenTraits.set(TokenType.CharLiteral, {
  expressionStart: true,
  literal: true,
});
tokenTraits.set(TokenType.CiEqual, {});
tokenTraits.set(TokenType.CiNotEqual, {});
tokenTraits.set(TokenType.Colon, {});
tokenTraits.set(TokenType.Comma, {});
tokenTraits.set(TokenType.CompareBinPragma, { pragma: true });
tokenTraits.set(TokenType.Continue, { statement: true });
tokenTraits.set(TokenType.Cp, { instruction: true });
tokenTraits.set(TokenType.Cpd, { instruction: true, simple: true });
tokenTraits.set(TokenType.Cpdr, { instruction: true, simple: true });
tokenTraits.set(TokenType.Cpi, { instruction: true, simple: true });
tokenTraits.set(TokenType.Cpir, { instruction: true, simple: true });
tokenTraits.set(TokenType.Cpl, { instruction: true, simple: true });
tokenTraits.set(TokenType.CurAddress, { expressionStart: true, literal: true });
tokenTraits.set(TokenType.CurCnt, { expressionStart: true, literal: true });

// ----------------------------------------------------------------------------
// D
tokenTraits.set(TokenType.D, { reg: true, reg8: true });
tokenTraits.set(TokenType.DE, { reg: true, reg16: true });
tokenTraits.set(TokenType.Daa, { instruction: true, simple: true });
tokenTraits.set(TokenType.Dec, { instruction: true });
tokenTraits.set(TokenType.DecimalLiteral, {
  expressionStart: true,
  literal: true,
});
tokenTraits.set(TokenType.Def, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.DefbPragma, { pragma: true });
tokenTraits.set(TokenType.DefcPragma, { pragma: true });
tokenTraits.set(TokenType.DefgPragma, { pragma: true });
tokenTraits.set(TokenType.DefgxPragma, { pragma: true });
tokenTraits.set(TokenType.DefhPragma, { pragma: true });
tokenTraits.set(TokenType.DefineDir, { directive: true });
tokenTraits.set(TokenType.DefmPragma, { pragma: true });
tokenTraits.set(TokenType.DefnPragma, { pragma: true });
tokenTraits.set(TokenType.DefsPragma, { pragma: true });
tokenTraits.set(TokenType.DefwPragma, { pragma: true });
tokenTraits.set(TokenType.Di, { instruction: true, simple: true });
tokenTraits.set(TokenType.DispPragma, { pragma: true });
tokenTraits.set(TokenType.Divide, {});
tokenTraits.set(TokenType.Djnz, { instruction: true });
tokenTraits.set(TokenType.Dot, { expressionStart: true, literal: true });
tokenTraits.set(TokenType.DoubleColon, { expressionStart: true });

// ----------------------------------------------------------------------------
// E
tokenTraits.set(TokenType.E, { reg: true, reg8: true });
tokenTraits.set(TokenType.Ei, { instruction: true, simple: true });
tokenTraits.set(TokenType.Elif, { statement: true });
tokenTraits.set(TokenType.Else, { statement: true });
tokenTraits.set(TokenType.ElseDir, { directive: true });
tokenTraits.set(TokenType.EndIfDir, { directive: true });
tokenTraits.set(TokenType.EndModule, { statement: true });
tokenTraits.set(TokenType.Endif, { statement: true });
tokenTraits.set(TokenType.Endl, { statement: true });
tokenTraits.set(TokenType.Endm, { statement: true });
tokenTraits.set(TokenType.Endp, { statement: true });
tokenTraits.set(TokenType.Ends, { statement: true });
tokenTraits.set(TokenType.Endw, { statement: true });
tokenTraits.set(TokenType.EntPragma, { pragma: true });
tokenTraits.set(TokenType.EquPragma, { pragma: true });
tokenTraits.set(TokenType.Equal, {});
tokenTraits.set(TokenType.ErrorPragma, { pragma: true });
tokenTraits.set(TokenType.Ex, { instruction: true });
tokenTraits.set(TokenType.Exclamation, { expressionStart: true });
tokenTraits.set(TokenType.ExternPragma, { pragma: true });
tokenTraits.set(TokenType.Exx, { instruction: true, simple: true });

// ----------------------------------------------------------------------------
// F
tokenTraits.set(TokenType.False, { expressionStart: true, literal: true });
tokenTraits.set(TokenType.FillbPragma, { pragma: true });
tokenTraits.set(TokenType.FillwPragma, { pragma: true });
tokenTraits.set(TokenType.For, { statement: true });

// ----------------------------------------------------------------------------
// G
tokenTraits.set(TokenType.GoesTo, {});
tokenTraits.set(TokenType.GreaterThan, {});
tokenTraits.set(TokenType.GreaterThanOrEqual, {});

// ----------------------------------------------------------------------------
// H
tokenTraits.set(TokenType.H, { reg: true, reg8: true });
tokenTraits.set(TokenType.HL, { reg: true, reg16: true });
tokenTraits.set(TokenType.HReg, {});
tokenTraits.set(TokenType.Halt, { instruction: true, simple: true });
tokenTraits.set(TokenType.HexadecimalLiteral, {
  expressionStart: true,
  literal: true,
});

// ----------------------------------------------------------------------------
// H
tokenTraits.set(TokenType.I, { reg: true, reg8Spec: true });
tokenTraits.set(TokenType.IX, { reg: true, reg16Idx: true });
tokenTraits.set(TokenType.IY, { reg: true, reg16Idx: true });
tokenTraits.set(TokenType.Identifier, { expressionStart: true });
tokenTraits.set(TokenType.If, { statement: true });
tokenTraits.set(TokenType.IfDefDir, { directive: true });
tokenTraits.set(TokenType.IfDir, { directive: true });
tokenTraits.set(TokenType.IfModDir, { directive: true });
tokenTraits.set(TokenType.IfNDefDir, { directive: true });
tokenTraits.set(TokenType.IfNModDir, { directive: true });
tokenTraits.set(TokenType.IfNUsed, { statement: true });
tokenTraits.set(TokenType.IfUsed, { statement: true });
tokenTraits.set(TokenType.Im, { instruction: true });
tokenTraits.set(TokenType.In, { instruction: true });
tokenTraits.set(TokenType.Inc, { instruction: true });
tokenTraits.set(TokenType.IncludeBinPragma, { pragma: true });
tokenTraits.set(TokenType.IncludeDir, { directive: true });
tokenTraits.set(TokenType.Ind, { instruction: true, simple: true });
tokenTraits.set(TokenType.Indr, { instruction: true, simple: true });
tokenTraits.set(TokenType.Ini, { instruction: true, simple: true });
tokenTraits.set(TokenType.Inir, { instruction: true, simple: true });
tokenTraits.set(TokenType.InjectOptPragma, { pragma: true });
tokenTraits.set(TokenType.InlineComment, {});
tokenTraits.set(TokenType.IsCPort, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsCondition, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsExpr, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsIndexedAddr, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsReg16, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsReg16Idx, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsReg16Std, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsReg8, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsReg8Idx, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsReg8Spec, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsReg8Std, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsRegIndirect, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsRegA, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsRegAf, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsRegB, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsRegC, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsRegBc, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsRegD, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsRegE, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsRegDe, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsRegH, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsRegL, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsRegHl, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsRegI, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsRegR, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsRegXh, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsRegXl, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsRegIx, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsRegYh, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsRegYl, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsRegIy, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.IsRegSp, {
  expressionStart: true,
  builtInFunction: true,
});

// ----------------------------------------------------------------------------
// J
tokenTraits.set(TokenType.Jp, { instruction: true });
tokenTraits.set(TokenType.Jr, { instruction: true });

// ----------------------------------------------------------------------------
// L
tokenTraits.set(TokenType.L, { reg: true, reg8: true });
tokenTraits.set(TokenType.LDBrac, { expressionStart: true });
tokenTraits.set(TokenType.LineDir, { directive: true });
tokenTraits.set(TokenType.LPar, { expressionStart: true });
tokenTraits.set(TokenType.LReg, {});
tokenTraits.set(TokenType.LSBrac, { expressionStart: true });
tokenTraits.set(TokenType.LTextOf, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.Ld, { instruction: true });
tokenTraits.set(TokenType.Ldd, { instruction: true, simple: true });
tokenTraits.set(TokenType.Lddr, { instruction: true, simple: true });
tokenTraits.set(TokenType.Lddrx, { instruction: true, simple: true });
tokenTraits.set(TokenType.Lddx, { instruction: true, simple: true });
tokenTraits.set(TokenType.Ldi, { instruction: true, simple: true });
tokenTraits.set(TokenType.Ldir, { instruction: true, simple: true });
tokenTraits.set(TokenType.Ldirx, { instruction: true, simple: true });
tokenTraits.set(TokenType.Ldix, { instruction: true, simple: true });
tokenTraits.set(TokenType.Ldpirx, { instruction: true, simple: true });
tokenTraits.set(TokenType.Ldws, { instruction: true, simple: true });
tokenTraits.set(TokenType.LeftShift, {});
tokenTraits.set(TokenType.LessThan, {});
tokenTraits.set(TokenType.LessThanOrEqual, {});
tokenTraits.set(TokenType.Local, { statement: true });
tokenTraits.set(TokenType.Loop, { statement: true });

// ----------------------------------------------------------------------------
// M
tokenTraits.set(TokenType.M, { condition: true });
tokenTraits.set(TokenType.Macro, { statement: true });
tokenTraits.set(TokenType.MaxOp, {});
tokenTraits.set(TokenType.MinOp, {});
tokenTraits.set(TokenType.Minus, { expressionStart: true });
tokenTraits.set(TokenType.Mirror, { instruction: true });
tokenTraits.set(TokenType.ModelPragma, { pragma: true });
tokenTraits.set(TokenType.Module, { statement: true });
tokenTraits.set(TokenType.Modulo, {});
tokenTraits.set(TokenType.Mul, { instruction: true });
tokenTraits.set(TokenType.Multiplication, {
  expressionStart: true,
  literal: true,
});

// ----------------------------------------------------------------------------
// N
tokenTraits.set(TokenType.NC, { condition: true, relCondition: true });
tokenTraits.set(TokenType.NZ, { condition: true, relCondition: true });
tokenTraits.set(TokenType.Neg, { instruction: true, simple: true });
tokenTraits.set(TokenType.Next, { statement: true });
tokenTraits.set(TokenType.NextReg, { instruction: true });
tokenTraits.set(TokenType.NoneArg, {});
tokenTraits.set(TokenType.Nop, { instruction: true, simple: true });
tokenTraits.set(TokenType.NotEqual, {});

// ----------------------------------------------------------------------------
// O
tokenTraits.set(TokenType.OctalLiteral, {
  expressionStart: true,
  literal: true,
});
tokenTraits.set(TokenType.Or, { instruction: true });
tokenTraits.set(TokenType.OrgPragma, { pragma: true });
tokenTraits.set(TokenType.Otdr, { instruction: true, simple: true });
tokenTraits.set(TokenType.Otir, { instruction: true, simple: true });
tokenTraits.set(TokenType.Out, { instruction: true });
tokenTraits.set(TokenType.OutInB, { instruction: true, simple: true });
tokenTraits.set(TokenType.Outd, { instruction: true, simple: true });
tokenTraits.set(TokenType.Outi, { instruction: true, simple: true });

// ----------------------------------------------------------------------------
// P
tokenTraits.set(TokenType.P, { condition: true });
tokenTraits.set(TokenType.PE, { condition: true });
tokenTraits.set(TokenType.PO, { condition: true });
tokenTraits.set(TokenType.PixelAd, { instruction: true, simple: true });
tokenTraits.set(TokenType.PixelDn, { instruction: true, simple: true });
tokenTraits.set(TokenType.Plus, { expressionStart: true });
tokenTraits.set(TokenType.Pop, { instruction: true });
tokenTraits.set(TokenType.Proc, { statement: true });
tokenTraits.set(TokenType.Push, { instruction: true });

// ----------------------------------------------------------------------------
// Q
tokenTraits.set(TokenType.QuestionMark, {});

// ----------------------------------------------------------------------------
// R
tokenTraits.set(TokenType.R, { reg: true, reg8Spec: true });
tokenTraits.set(TokenType.RDBrac, {});
tokenTraits.set(TokenType.RPar, {});
tokenTraits.set(TokenType.RSBrac, {});
tokenTraits.set(TokenType.RealLiteral, {
  expressionStart: true,
  literal: true,
});
tokenTraits.set(TokenType.Repeat, { statement: true });
tokenTraits.set(TokenType.Res, { instruction: true });
tokenTraits.set(TokenType.Ret, { instruction: true });
tokenTraits.set(TokenType.Reti, { instruction: true, simple: true });
tokenTraits.set(TokenType.Retn, { instruction: true, simple: true });
tokenTraits.set(TokenType.RightShift, {});
tokenTraits.set(TokenType.Rl, { instruction: true });
tokenTraits.set(TokenType.Rla, { instruction: true, simple: true });
tokenTraits.set(TokenType.Rlc, { instruction: true });
tokenTraits.set(TokenType.Rlca, { instruction: true, simple: true });
tokenTraits.set(TokenType.Rld, { instruction: true, simple: true });
tokenTraits.set(TokenType.RndSeedPragma, { pragma: true });
tokenTraits.set(TokenType.Rr, { instruction: true });
tokenTraits.set(TokenType.Rra, { instruction: true, simple: true });
tokenTraits.set(TokenType.Rrc, { instruction: true });
tokenTraits.set(TokenType.Rrca, { instruction: true, simple: true });
tokenTraits.set(TokenType.Rrd, { instruction: true, simple: true });
tokenTraits.set(TokenType.Rst, { instruction: true });

// ----------------------------------------------------------------------------
// S
tokenTraits.set(TokenType.SP, { reg: true, reg16: true });
tokenTraits.set(TokenType.Sbc, { instruction: true });
tokenTraits.set(TokenType.Scf, { instruction: true, simple: true });
tokenTraits.set(TokenType.Set, { instruction: true });
tokenTraits.set(TokenType.SetAE, { instruction: true, simple: true });
tokenTraits.set(TokenType.SkipPragma, { pragma: true });
tokenTraits.set(TokenType.Sla, { instruction: true });
tokenTraits.set(TokenType.Sll, { instruction: true });
tokenTraits.set(TokenType.Sra, { instruction: true });
tokenTraits.set(TokenType.Srl, { instruction: true });
tokenTraits.set(TokenType.Step, {});
tokenTraits.set(TokenType.StringLiteral, {
  expressionStart: true,
  literal: true,
});
tokenTraits.set(TokenType.Struct, { statement: true });
tokenTraits.set(TokenType.Sub, { instruction: true });
tokenTraits.set(TokenType.Swapnib, { instruction: true, simple: true });

// ----------------------------------------------------------------------------
// T
tokenTraits.set(TokenType.Test, { instruction: true });
tokenTraits.set(TokenType.TextOf, {
  expressionStart: true,
  builtInFunction: true,
});
tokenTraits.set(TokenType.To, {});
tokenTraits.set(TokenType.TracePragma, { pragma: true });
tokenTraits.set(TokenType.TraceHexPragma, { pragma: true });
tokenTraits.set(TokenType.True, { expressionStart: true, literal: true });

// ----------------------------------------------------------------------------
// U
tokenTraits.set(TokenType.UndefDir, {});
tokenTraits.set(TokenType.Until, { statement: true });
tokenTraits.set(TokenType.UpArrow, {});

// ----------------------------------------------------------------------------
// V
tokenTraits.set(TokenType.VarPragma, { pragma: true });
tokenTraits.set(TokenType.VerticalBar, {});

// ----------------------------------------------------------------------------
// W
tokenTraits.set(TokenType.While, { statement: true });

// ----------------------------------------------------------------------------
// X
tokenTraits.set(TokenType.XH, { reg: true, reg8Idx: true });
tokenTraits.set(TokenType.XL, { reg: true, reg8Idx: true });
tokenTraits.set(TokenType.XentPragma, { pragma: true });
tokenTraits.set(TokenType.Xor, { instruction: true });
tokenTraits.set(TokenType.XorgPragma, { pragma: true });

// ----------------------------------------------------------------------------
// Y
tokenTraits.set(TokenType.YH, { reg: true, reg8Idx: true });
tokenTraits.set(TokenType.YL, { reg: true, reg8Idx: true });

// ----------------------------------------------------------------------------
// Z
tokenTraits.set(TokenType.Z, { condition: true, relCondition: true });
tokenTraits.set(TokenType.ZxBasicPragma, { pragma: true });
