import { InputStream } from "./input-stream";

/**
 * This class implements the tokenizer (lexer) of the Z80 Assembler
 */
export class TokenStream {
  // --- Already fetched tokens
  private _ahead: Token[] = [];

  // --- Prefetched character (from the next token)
  private _prefetched: string | null = null;

  // --- Prefetched character position (from the next token)
  private _prefetchedPos: number | null = null;

  // --- Prefetched character column (from the next token)
  private _prefetchedColumn: number | null = null;

  /**
   * Initializes the tokenizer with the input stream
   * @param input Input source code stream
   */
  constructor(public readonly input: InputStream) {}

  /**
   * Fethches the next token without advancing to its position
   * @param ws If true, retrieve whitespaces too
   */
  peek(ws = false): Token {
    return this.ahead(0, ws);
  }

  /**
   *
   * @param n Number of token positions to read ahead
   * @param ws If true, retrieve whitespaces too
   */
  ahead(n = 1, ws = false): Token {
    if (n > 16) {
      throw new Error("Cannot look ahead more than 16 tokens");
    }

    // --- Prefetch missing tokens
    while (this._ahead.length < n) {
      const token = this.fetch();
      if (isEof(token)) {
        return token;
      }
      if (ws || (!ws && !isWs(token))) {
        this._ahead.push(token);
      }
    }
    return this._ahead[n];
  }

  /**
   * Fethces the nex token and advances the stream position
   * @param ws If true, retrieve whitespaces too
   */
  get(ws = false): Token {
    if (this._ahead.length > 0) {
      return this._ahead.shift();
    }
    while (true) {
      const token = this.fetch();
      if (isEof(token) || ws || (!ws && !isWs(token))) {
        return token;
      }
    }
  }

  /**
   * Fetches the next token from the input stream
   */
  private fetch(): Token {
    const lexer = this;
    const input = this.input;
    const startPos = this._prefetchedPos || input.position;
    const line = input.line;
    const startColumn = this._prefetchedColumn || input.column;
    let text = "";
    let tokenType = TokenType.Eof;
    let lastEndPos = input.position;
    let lastEndColumn = input.column;
    let ch: string | null = null;
    let useResolver = false;

    let phase: LexerPhase = LexerPhase.Start;
    while (true) {
      // --- Get the next character
      ch = fetchNextChar();

      // --- In case of EOF, return the current token data
      if (ch === null) {
        return makeToken();
      }

      // --- Set the intial token type to unknown for the other characters
      if (tokenType === TokenType.Eof) {
        tokenType = TokenType.Unknown;
      }

      // --- Follow the lexer state machine
      switch (phase) {
        // ====================================================================
        // Process the first character
        case LexerPhase.Start:
          switch (ch) {
            // --- Go on with whitespaces
            case " ":
            case "\t":
              phase = LexerPhase.InWhiteSpace;
              tokenType = TokenType.Ws;
              break;

            // --- Standard assembly comment
            case ";":
              phase = LexerPhase.InEolComment;
              tokenType = TokenType.EolComment;
              break;

            // --- Divison or comment
            case "/":
              phase = LexerPhase.InPotentialComment;
              tokenType = TokenType.Divide;
              break;

            // --- New line
            case "\n":
              return completeToken(TokenType.NewLine);

            // --- Potential new line
            case "\r":
              phase = LexerPhase.PotentialNewLine;
              tokenType = TokenType.NewLine;
              break;

            // --- ":", "::", or ":="
            case ":":
              phase = LexerPhase.Colon;
              tokenType = TokenType.Colon;
              break;

            // --- Comma
            case ",":
              return completeToken(TokenType.Comma);

            // --- "=", "==", and "==="
            case "=":
              phase = LexerPhase.Assign;
              tokenType = TokenType.Assign;
              break;

            // --- Left parenthesis
            case "(":
              return completeToken(TokenType.LPar);

            // --- Right parenthesis
            case ")":
              return completeToken(TokenType.RPar);

            // --- Left square bracket
            case "[":
              return completeToken(TokenType.LSBrac);

            // --- Right square bracket
            case "]":
              return completeToken(TokenType.RSBrac);

            // --- Question mark
            case "?":
              return completeToken(TokenType.QuestionMark);

            // --- Plus mark
            case "+":
              return completeToken(TokenType.Plus);

            // --- "-" or "->"
            case "-":
              phase = LexerPhase.Minus;
              tokenType = TokenType.Minus;
              break;

            // --- Vertical bar
            case "|":
              return completeToken(TokenType.VerticalBar);

            // --- Up arrow
            case "^":
              return completeToken(TokenType.UpArrow);

            // --- Ampersand
            case "&":
              return completeToken(TokenType.Ampersand);

            // --- "!", "!=", or "!=="
            case "!":
              phase = LexerPhase.Exclamation;
              tokenType = TokenType.Exclamation;
              break;

            // --- "<", "<=", "<<", "<?", or file-string
            case "<":
              phase = LexerPhase.AngleLeft;
              tokenType = TokenType.LessThan;
              break;

            // --- ">", ">=", ">>", ">?", or file-string
            case ">":
              phase = LexerPhase.AngleRight;
              tokenType = TokenType.GreaterThan;
              break;

            // --- Multiplication operation
            case "*":
              return completeToken(TokenType.Multiplication);

            // --- Modulo operation or binary literal
            case "%":
              phase = LexerPhase.ModuloOrBinary;
              tokenType = TokenType.Modulo;
              break;

            // --- Binary not
            case "~":
              return completeToken(TokenType.BinaryNot);

            // --- Beginning "{{"
            case "{":
              phase = LexerPhase.LBracket;
              break;

            // --- Beginning "}}"
            case "}":
              phase = LexerPhase.RBracket;
              break;

            // ---".", keyword-like, real number
            case ".":
              phase = LexerPhase.Dot;
              tokenType = TokenType.Dot;
              break;

            // --- "#" received
            case "#":
              phase = LexerPhase.DirectiveOrHexLiteral;
              break;

            // --- "$" received
            case "$":
              phase = LexerPhase.Dollar;
              tokenType = TokenType.CurAddress;
              break;

            // Start of a numeric literal
            case "0":
              phase = LexerPhase.NumericLiteral0;
              tokenType = TokenType.DecimalLiteral;
              break;

            case "'":
              phase = LexerPhase.Char;
              break;

            case '"':
              phase = LexerPhase.String;
              break;

            default:
              if (ch >= "1" && ch <= "9") {
                phase = LexerPhase.NumericLiteral1_9;
                tokenType = TokenType.DecimalLiteral;
              } else if (isIdStart(ch)) {
                useResolver = true;
                phase = LexerPhase.IdTail;
              }
              break;
          }
          break;

        // ====================================================================
        // Process whitespaces, comments, and new line

        // --- Looking for the end of whitespace
        case LexerPhase.InWhiteSpace:
          if (ch !== " " && ch !== "\t") {
            return makeToken();
          }
          break;

        // --- Looking for the end of ";" comment
        case LexerPhase.InEolComment:
          if (ch === "\r" || ch === "\n") {
            return makeToken();
          }
          break;

        // --- Looking for the beginning an "//" or "/*" comment
        case LexerPhase.InPotentialComment:
          switch (ch) {
            case "/":
              phase = LexerPhase.InEolComment;
              tokenType = TokenType.EolComment;
              break;
            case "*":
              phase = LexerPhase.InlineCommentBody;
              tokenType = TokenType.Unknown;
              break;
            default:
              return makeToken();
          }
          break;

        // --- Looking for the "*" within an inline comment
        case LexerPhase.InlineCommentBody:
          if (ch === "*") {
            phase = LexerPhase.InlineCommentTail;
          } else if (ch === "\r" || ch === "\n") {
            // --- Invalid continuation of an inline comment
            return makeToken();
          }
          break;

        // --- Looking for the closing "/" of an inline comment
        case LexerPhase.InlineCommentTail:
          if (ch === "/") {
            return completeToken(TokenType.InlineComment);
          }
          break;

        // --- We already received a "\r", so this is a new line
        case LexerPhase.PotentialNewLine:
          if (ch === "\n") {
            return completeToken(TokenType.NewLine);
          }
          return makeToken();

        // ====================================================================
        // Operator-like tokens

        // --- Colon or double colon
        case LexerPhase.Colon:
          if (ch === ":") {
            return completeToken(TokenType.DoubleColon);
          } else if (ch === "=") {
            return completeToken(TokenType.Var);
          }
          return makeToken();

        // --- Assign or equal
        case LexerPhase.Assign:
          if (ch !== "=") {
            return makeToken();
          }
          phase = LexerPhase.Equal;
          tokenType = TokenType.Equal;
          break;

        // --- Equal or case-insensitive equal
        case LexerPhase.Equal:
          if (ch === "=") {
            return completeToken(TokenType.CiEqual);
          }
          return makeToken();

        // --- "-" or "->"
        case LexerPhase.Minus:
          if (ch === ">") {
            return completeToken(TokenType.GoesTo);
          }
          return makeToken();

        // --- Exclamation ot not equal
        case LexerPhase.Exclamation:
          if (ch !== "=") {
            return makeToken();
          }
          phase = LexerPhase.NotEqual;
          tokenType = TokenType.NotEqual;
          break;

        // --- Not equal or case-insensitive not equal
        case LexerPhase.NotEqual:
          if (ch === "=") {
            return completeToken(TokenType.CiNotEqual);
          }
          return makeToken();

        // --- "<", "<=", "<<", "<?", or file-string
        case LexerPhase.AngleLeft:
          switch (ch) {
            case "=":
              return completeToken(TokenType.LessThanOrEqual);
            case "<":
              return completeToken(TokenType.LeftShift);
            case "?":
              return completeToken(TokenType.MinOp);
            default:
              return makeToken();
          }

        // --- ">", ">=", ">>", ">?"
        case LexerPhase.AngleRight:
          switch (ch) {
            case "=":
              return completeToken(TokenType.GreaterThanOrEqual);
            case ">":
              return completeToken(TokenType.RightShift);
            case "?":
              return completeToken(TokenType.MaxOp);
            default:
              return makeToken();
          }

        // --- "{{"
        case LexerPhase.LBracket:
          if (ch === "{") {
            return completeToken(TokenType.LDBrac);
          }
          return makeToken();

        // --- "}}"
        case LexerPhase.RBracket:
          if (ch === "}") {
            return completeToken(TokenType.RDBrac);
          }
          return makeToken();

        // --- ".", keyword-like, real-number
        case LexerPhase.Dot:
          if (isLetter(ch)) {
            phase = LexerPhase.KeywordLike;
          } else if (isDecimalDigit(ch)) {
            phase = LexerPhase.FractionalPartTail;
            tokenType = TokenType.RealLiteral;
          } else {
            return makeToken();
          }
          break;

        // ====================================================================
        // Identifier and keyword like tokens

        // --- Wait for the completion of an identifier
        case LexerPhase.IdTail:
          if (ch === "'") {
            return completeToken(TokenType.Identifier);
          } else if (!isIdContinuation(ch)) {
            return makeToken();
          }
          break;

        // --- Wait for the completion of a keyword-like character
        case LexerPhase.KeywordLike:
          useResolver = true;
          if (!isLetterOrDigit(ch) && ch !== "_") {
            return makeToken();
          }
          break;

        // --- Wait for the completion of hexadecimal number of preprocessor directive
        case LexerPhase.DirectiveOrHexLiteral:
          if (isLetterOrDigit(ch)) {
            if (input.peek() !== null) break;
            appendTokenChar();
          }
          if (
            text.length <= 5 &&
            text
              .substr(1)
              .split("")
              .every((c) => isHexadecimalDigit(c))
          ) {
            tokenType = TokenType.HexadecimalLiteral;
          } else {
            useResolver = true;
          }
          return makeToken();

        // --- Continuation of a "$"
        case LexerPhase.Dollar:
          if (ch === "<") {
            phase = LexerPhase.NoneArgTail;
            break;
          }
          if (isLetterOrDigit(ch)) {
            if (input.peek() !== null) break;
            appendTokenChar();
          }
          if (
            text.length <= 5 &&
            text
              .substr(1)
              .split("")
              .every((c) => isHexadecimalDigit(c))
          ) {
            tokenType = TokenType.HexadecimalLiteral;
          } else {
            useResolver = true;
          }
          return makeToken();

        // --- Wait for the completion od "$<none>$" placeholder
        case LexerPhase.NoneArgTail:
          if (ch === "$") {
            useResolver = false;
            tokenType =
              text === "$<none>" ? TokenType.NoneArg : TokenType.Unknown;
            return completeToken();
          }
          break;

        // ====================================================================
        // --- Literals

        // --- Modulo operator or continuation of a binary literal
        case LexerPhase.ModuloOrBinary:
          if (!isBinaryDigit(ch)) {
            return makeToken();
          }
          phase = LexerPhase.BinLiteral;
          tokenType = TokenType.BinaryLiteral;
          break;

        // --- Wait for the completion of a binary literal
        case LexerPhase.BinLiteral:
          if (!isBinaryDigit(ch)) {
            return makeToken();
          }
          break;

        // --- "0" received
        case LexerPhase.NumericLiteral0:
          if (ch === "x") {
            // --- Test if the look-ahead char is a hexadecimal literal
            const nextCh = input.peek();
            if (!nextCh || !isHexadecimalDigit(nextCh)) {
              return completeToken(TokenType.Unknown);
            }
            phase = LexerPhase.HexaLiteralPrefix;
            break;
          } else if (ch === "b") {
            // --- Binary or hexadecimal literal. Look ahead to check
            const nextCh = input.peek();
            if (
              !nextCh ||
              (!isBinaryDigit(nextCh) && !isHexadecimalDigit(nextCh))
            ) {
              return completeToken(TokenType.Unknown);
            }
            if (
              isHexaSuffix(input.ahead(1)) ||
              isHexaSuffix(input.ahead(2)) ||
              isHexaSuffix(input.ahead(3)) ||
              isHexaSuffix(input.ahead(4))
            ) {
              phase = LexerPhase.HexaLiteralSuffix;
              break;
            }
          } else if (isHexaSuffix(ch)) {
            return completeToken(TokenType.HexadecimalLiteral);
          } else if (isOctalSuffix(ch)) {
            return completeToken(TokenType.OctalLiteral);
          } else if (isDecimalDigit(ch)) {
            phase = LexerPhase.DecimalOrReal;
            tokenType = TokenType.DecimalLiteral;
          } else if (ch === "e" || ch === "E") {
            phase = LexerPhase.ExponentSign;
          } else if (ch === ".") {
            phase = LexerPhase.FractionalPart;
          } else {
            return makeToken();
          }

        // --- This previous case intentionally flows to this label
        case LexerPhase.NumericLiteral1_9:
          // --- Octal, decimal, or suffixed hexadecimal
          if (isHexaSuffix(ch)) {
            return completeToken(TokenType.HexadecimalLiteral);
          }
          const startIsOctal = text >= "0" && text <= "7";
          if (isOctalSuffix(ch)) {
            return startIsOctal
              ? completeToken(TokenType.OctalLiteral)
              : completeToken(TokenType.Unknown);
          }
          const nextCh = input.peek();
          if (startIsOctal && nextCh && isOctalSuffix(nextCh)) {
            phase = LexerPhase.OctalLiteralSuffix;
          } else if (nextCh && isHexaSuffix(nextCh)) {
            phase = LexerPhase.OctalLiteralSuffix;
          } else if (startIsOctal && isOctalSuffix(input.ahead(1))) {
            phase = LexerPhase.OctalLiteralSuffix;
          } else if (isHexaSuffix(input.ahead(1))) {
            phase = LexerPhase.HexaLiteralSuffix;
          } else if (startIsOctal && isOctalSuffix(input.ahead(2))) {
            phase = LexerPhase.OctalLiteralSuffix;
          } else if (isHexaSuffix(input.ahead(2))) {
            phase = LexerPhase.HexaLiteralSuffix;
          } else if (startIsOctal && isOctalSuffix(input.ahead(3))) {
            phase = LexerPhase.OctalLiteralSuffix;
          } else if (isHexaSuffix(input.ahead(3))) {
            phase = LexerPhase.HexaLiteralSuffix;
          } else if (startIsOctal && isOctalSuffix(input.ahead(4))) {
            phase = LexerPhase.OctalLiteralSuffix;
          } else if (startIsOctal && isOctalSuffix(input.ahead(5))) {
            phase = LexerPhase.OctalLiteralSuffix;
          } else if (isDecimalDigit(ch)) {
            phase = LexerPhase.DecimalOrReal;
            tokenType = TokenType.DecimalLiteral;
          } else if (ch === "e" || ch === "E") {
            phase = LexerPhase.ExponentSign;
            tokenType = TokenType.RealLiteral;
          } else if (ch === ".") {
            phase = LexerPhase.FractionalPart;
          } else {
            return makeToken();
          }
          break;

        // --- Wait for the completion of hexadecimal literal
        case LexerPhase.HexaLiteralPrefix:
          if (isHexadecimalDigit(ch)) {
            if (text.length >= 6) {
              return completeToken(TokenType.Unknown);
            }
            tokenType = TokenType.HexadecimalLiteral;
          } else {
            return makeToken();
          }
          break;

        // --- Wait for the completion of a suffixed hexadecimal literal
        case LexerPhase.HexaLiteralSuffix:
          if (isHexadecimalDigit(ch)) {
            tokenType = TokenType.HexadecimalLiteral;
          } else if (!isHexaSuffix(ch)) {
            return completeToken(TokenType.Unknown);
          } else {
            return completeToken(TokenType.HexadecimalLiteral);
          }
          break;

        // --- Wait for the completion of a suffixed octal literal
        case LexerPhase.OctalLiteralSuffix:
          if (isOctalDigit(ch)) {
            tokenType = TokenType.OctalLiteral;
          } else if (!isOctalSuffix(ch)) {
            return completeToken(TokenType.Unknown);
          } else {
            return completeToken(TokenType.OctalLiteral);
          }
          break;

        // Number can be decimal or real
        case LexerPhase.DecimalOrReal:
          if (ch === ".") {
            phase = LexerPhase.FractionalPart;
          } else if (ch === "e" || ch === "E") {
            phase = LexerPhase.ExponentSign;
          } else if (!isDecimalDigit(ch)) {
            return makeToken();
          }
          break;

        // First digit of fractional part
        case LexerPhase.FractionalPart:
          if (!isDecimalDigit(ch)) {
            return completeToken(TokenType.Unknown);
          }
          phase = LexerPhase.FractionalPartTail;
          tokenType = TokenType.RealLiteral;
          break;

        // Remaining digits of fractional part
        case LexerPhase.FractionalPartTail:
          if (ch === "e" || ch === "E") {
            phase = LexerPhase.ExponentSign;
          } else if (!isDecimalDigit(ch)) {
            return makeToken();
          }
          break;

        // Wait for exponent sign
        case LexerPhase.ExponentSign:
          if (ch === "+" || ch === "-") {
            tokenType = TokenType.Unknown;
            phase = LexerPhase.ExponentDigit;
          } else if (isDecimalDigit(ch)) {
            phase = LexerPhase.ExponentTail;
          } else {
            return makeToken();
          }
          break;

        // First digit of exponent
        case LexerPhase.ExponentDigit:
          if (!isDecimalDigit(ch)) {
            return makeToken();
          }
          phase = LexerPhase.ExponentTail;
          tokenType = TokenType.RealLiteral;
          break;

        // Remaining digits of exponent
        case LexerPhase.ExponentTail:
          if (isDecimalDigit(ch)) {
            break;
          }
          return makeToken();

        // Character data
        case LexerPhase.Char:
          if (isRestrictedInString(ch)) {
            return completeToken(TokenType.Unknown);
          } else if (ch === "\\") {
            phase = LexerPhase.CharBackSlash;
            tokenType = TokenType.Unknown;
          } else {
            phase = LexerPhase.CharTail;
          }
          break;

        // Character literal delimiter
        case LexerPhase.CharTail:
          return ch === "'"
            ? completeToken(TokenType.CharLiteral)
            : completeToken(TokenType.Unknown);

        // Start of character escape
        case LexerPhase.CharBackSlash:
          switch (ch) {
            case "i":
            case "p":
            case "f":
            case "b":
            case "I":
            case "o":
            case "a":
            case "t":
            case "P":
            case "C":
            case "'":
            case '"':
            case "\\":
            case "0":
              phase = LexerPhase.CharTail;
              break;
            default:
              if (ch === "x") {
                phase = LexerPhase.CharHexa1;
              } else {
                return completeToken(TokenType.Unknown);
              }
          }
          break;

        // First hexadecimal digit of character escape
        case LexerPhase.CharHexa1:
          if (isHexadecimalDigit(ch)) {
            phase = LexerPhase.CharHexa2;
          } else {
            return completeToken(TokenType.Unknown);
          }
          break;

        // Second hexadecimal digit of character escape
        case LexerPhase.CharHexa2:
          if (isHexadecimalDigit(ch)) {
            phase = LexerPhase.CharTail;
          } else {
            return completeToken(TokenType.Unknown);
          }
          break;

        // String data
        case LexerPhase.String:
          if (ch === '"') {
            return completeToken(TokenType.StringLiteral);
          } else if (isRestrictedInString(ch)) {
            return completeToken(TokenType.Unknown);
          } else if (ch === "\\") {
            phase = LexerPhase.StringBackSlash;
            tokenType = TokenType.Unknown;
          }
          break;

        // Start of string character escape
        case LexerPhase.StringBackSlash:
          switch (ch) {
            case "i":
            case "p":
            case "f":
            case "b":
            case "I":
            case "o":
            case "a":
            case "t":
            case "P":
            case "C":
            case "'":
            case '"':
            case "\\":
            case "0":
              phase = LexerPhase.String;
              break;
            default:
              if (ch === "x") {
                phase = LexerPhase.StringHexa1;
              } else {
                return completeToken(TokenType.Unknown);
              }
          }
          break;

        // First hexadecimal digit of string character escape
        case LexerPhase.StringHexa1:
          if (isHexadecimalDigit(ch)) {
            phase = LexerPhase.StringHexa2;
          } else {
            return completeToken(TokenType.Unknown);
          }
          break;

        // Second hexadecimal digit of character escape
        case LexerPhase.StringHexa2:
          if (isHexadecimalDigit(ch)) {
            phase = LexerPhase.String;
          } else {
            return completeToken(TokenType.Unknown);
          }
          break;

        // ====================================================================
        // --- We cannot continue
        default:
          return makeToken();
      }

      // --- Append the char to the current text
      appendTokenChar();

      // --- Go on with parsing the next character
    }

    /**
     * Appends the last character to the token, and manages positions
     */
    function appendTokenChar(): void {
      text += ch;
      lexer._prefetched = null;
      lexer._prefetchedPos = null;
      lexer._prefetchedColumn = null;
      lastEndPos = input.position;
      lastEndColumn = input.position;
    }

    /**
     * Fetches the next character from the input stream
     */
    function fetchNextChar(): string | null {
      let ch: string;
      if (!lexer._prefetched) {
        lexer._prefetchedPos = input.position;
        lexer._prefetchedColumn = input.column;
        lexer._prefetched = input.get();
      }
      return lexer._prefetched;
    }

    /**
     * Packs the specified type of token to send back
     * @param type
     */
    function makeToken(): Token {
      if (useResolver) {
        tokenType =
          resolverHash[text] ??
          (isIdStart(text[0]) && text[text.length - 1] !== "'"
            ? TokenType.Identifier
            : TokenType.Unknown);
      }
      return {
        text,
        type: tokenType,
        location: {
          startPos,
          endPos: lastEndPos,
          line,
          startColumn,
          endColumn: lastEndColumn,
        },
      };
    }

    /**
     * Add the last character to the token and return it
     */
    function completeToken(suggestedType?: TokenType): Token {
      appendTokenChar();

      // --- Send back the token
      if (suggestedType !== undefined) {
        tokenType = suggestedType;
      }
      return makeToken();
    }
  }
}

/**
 * Represents a token
 */
export interface Token {
  /**
   * The raw text of the token
   */
  readonly text: string;

  /**
   * The type of the token
   */
  readonly type: TokenType;

  /**
   * The location of the token
   */
  readonly location: TokenLocation;
}

/**
 * Represents the location of a token
 */
export interface TokenLocation {
  /**
   * Start position in the source stream
   */
  readonly startPos: number;

  /**
   * End position in the source stream
   */
  readonly endPos: number;

  /**
   * Source code line of the token
   */
  readonly line: number;

  /**
   * The token's start column within the line
   */
  readonly startColumn: number;

  /**
   * The tokens end column within the line
   */
  readonly endColumn: number;
}

/**
 * This enumeration defines the token types
 */
export enum TokenType {
  Eof = -1,
  Ws = -2,
  InlineComment = -3,
  EolComment = -4,
  Unknown = 0,

  A,
  B,
  C,
  D,
  E,
  H,
  L,
  I,
  R,
  XL,
  XH,
  YL,
  YH,
  BC,
  DE,
  HL,
  SP,
  IX,
  IY,
  AF,
  AF_,
  Z,
  NZ,
  NC,
  PO,
  PE,
  P,
  M,

  Nop,
  Rlca,
  Rrca,
  Rla,
  Rra,
  Daa,
  Cpl,
  Scf,
  Ccf,
  Halt,
  Ret,
  Exx,
  Di,
  Ei,
  Neg,
  Retn,
  Reti,
  Rld,
  Rrd,
  Ldi,
  Cpi,
  Ini,
  Outi,
  Ldd,
  Cpd,
  Ind,
  Outd,
  Ldir,
  Cpir,
  Inir,
  Otir,
  Lddr,
  Cpdr,
  Indr,
  Otdr,

  Ld,
  Inc,
  Dec,
  Ex,
  Add,
  Adc,
  Sub,
  Sbc,
  And,
  Xor,
  Or,
  Cp,
  Djnz,
  Jr,
  Jp,
  Call,
  Rst,
  Push,
  Pop,
  In,
  Out,
  Im,
  Rlc,
  Rrc,
  Rl,
  Rr,
  Sla,
  Sra,
  Sll,
  Srl,
  Bit,
  Res,
  Set,

  Swapnib,
  Mirror,
  Test,
  Bsla,
  Bsra,
  Bsrl,
  Bsrf,
  Brlc,
  Mul,
  OutInB,
  NextReg,
  PixelDn,
  PixelAd,
  SetAE,
  Ldix,
  Ldws,
  Lddx,
  Ldirx,
  Ldpirx,
  Lddrx,

  Divide,
  NewLine,
  Colon,
  DoubleColon,
  Comma,
  Assign,
  Equal,
  CiEqual,
  LPar,
  RPar,
  LSBrac,
  RSBrac,
  QuestionMark,
  Plus,
  Minus,
  GoesTo,
  VerticalBar,
  UpArrow,
  Ampersand,
  Exclamation,
  NotEqual,
  CiNotEqual,
  LessThan,
  LessThanOrEqual,
  LeftShift,
  MinOp,
  GreaterThan,
  GreaterThanOrEqual,
  RightShift,
  MaxOp,
  Multiplication,
  Modulo,
  BinaryNot,
  LDBrac,
  RDBrac,
  Dot,

  Identifier,

  Org,
  Xorg,
  Ent,
  Xent,
  Equ,
  Var,
  Disp,
  Defb,
  Defw,
  Defm,
  Defn,
  Defh,
  Defgx,
  Defg,
  Defc,
  Skip,
  Extern,
  Defs,
  Fillb,
  Fillw,
  Model,
  Align,
  Trace,
  TraceHex,
  RndSeed,
  Error,
  IncludeBin,
  CompareBin,
  Macro,
  Endm,
  Proc,
  Endp,
  Loop,
  Endl,
  Repeat,
  Until,
  While,
  Endw,
  If,
  IfUsed,
  IfNUsed,
  Elif,
  Else,
  Endif,
  For,
  To,
  Step,
  Next,
  Break,
  Continue,
  Module,
  EndModule,
  Struct,
  Ends,

  TextOf,
  LTextOf,
  HReg,
  LReg,
  Def,
  IsReg8,
  IsReg8Std,
  IsReg8Spec,
  IsReg8Idx,
  IsReg16,
  IsReg16Std,
  IsReg16Idx,
  IsRegIndirect,
  IsCPort,
  IsIndexedAddr,
  IsCondition,
  IsExpr,

  True,
  False,
  CurCnt,

  IfDefDir,
  IfNDefDir,
  EndIfDir,
  ElseDir,
  DefineDir,
  UndefDir,
  IncludeDir,
  IfDir,
  IfModDir,
  IfNModDir,

  CurAddress,
  NoneArg,

  BinaryLiteral,
  OctalLiteral,
  DecimalLiteral,
  HexadecimalLiteral,
  RealLiteral,
  CharLiteral,
  StringLiteral,
}

/**
 * This enum indicates the current lexer phase
 */
enum LexerPhase {
  // Start getting a token
  Start = 0,

  // Collecting whitespace
  InWhiteSpace,

  // Collecting comment characters following ";"
  InEolComment,

  // Potential comment after "/"
  InPotentialComment,

  // Body of an inline comment
  InlineCommentBody,

  // Waiting for the end of an inline comment
  InlineCommentTail,

  // Waiting for "\n" after "\r"
  PotentialNewLine,

  // ":" received
  Colon,

  // "=" received
  Assign,

  // "==" received
  Equal,

  // "-" received
  Minus,

  // "!" received
  Exclamation,

  // "!=" received
  NotEqual,

  // "<" received
  AngleLeft,

  // ">" received
  AngleRight,

  // "{" received
  LBracket,

  // "}" received
  RBracket,

  // "." received
  Dot,

  // Waiting for keyword completion
  KeywordLike,

  // Waiting for the identifier completion
  IdTail,

  // "#" received
  DirectiveOrHexLiteral,

  // "$" received
  Dollar,

  // Wait for the end of "$<none>$"
  NoneArgTail,

  // "%" received
  ModuloOrBinary,

  // Wait for the completion of a binary literal
  BinLiteral,

  // "0" received
  NumericLiteral0,

  // "0" received
  NumericLiteral1_9,

  // "0b" received
  BinLeteralPrefix,

  // "0x" received
  HexaLiteralPrefix,

  // Wait for the completion of a suffixed hexadecimal
  HexaLiteralSuffix,

  // Wait for the completion of a suffixed octal number
  OctalLiteralSuffix,

  // Wait for the continuation of a decimal or real number
  DecimalOrReal,

  // Wait for for the first digit of fractional part
  FractionalPart,

  // Wait for completing the fractional part
  FractionalPartTail,

  // Wait for the sign of exponent
  ExponentSign,

  // Wait for the first exponent digit
  ExponentDigit,

  // Wait for the completion of exponent
  ExponentTail,

  // "'" received
  Char,

  CharBackSlash,

  CharHexa1,

  CharHexa2,

  CharTail,

  String,

  StringBackSlash,

  StringHexa1,

  StringHexa2,

  StringTail,
}

/**
 * Tests if a token id EOF
 * @param t Token instance
 */
function isEof(t: Token): boolean {
  return t.type === TokenType.Eof;
}

/**
 * Tests if a token is whitespace
 * @param t Token instance
 */
function isWs(t: Token): boolean {
  return t.type <= TokenType.Ws;
}

/**
 * Tests if a character is a letter
 * @param ch Character to test
 */
function isLetter(ch: string): boolean {
  return (ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z");
}

/**
 * Tests if a character is a letter
 * @param ch Character to test
 */
function isLetterOrDigit(ch: string): boolean {
  return (
    (ch >= "A" && ch <= "Z") ||
    (ch >= "a" && ch <= "z") ||
    (ch >= "0" && ch <= "9")
  );
}

/**
 * Tests if a character is a binary digit
 * @param ch Character to test
 */
function isBinaryDigit(ch: string): boolean {
  return ch === "0" || ch === "1" || ch === "_";
}

/**
 * Tests if a character is an octal digit
 * @param ch Character to test
 */
function isOctalDigit(ch: string): boolean {
  return ch >= "0" && ch <= "7";
}

/**
 * Tests if a character is a decimal digit
 * @param ch Character to test
 */
function isDecimalDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

/**
 * Tests if a character is a hexadecimal digit
 * @param ch Character to test
 */
function isHexadecimalDigit(ch: string): boolean {
  return (
    (ch >= "0" && ch <= "9") ||
    (ch >= "A" && ch <= "F") ||
    (ch >= "a" && ch <= "f")
  );
}

/**
 * Tests if a character can be the start of an identifier
 * @param ch Character to test
 */
function isIdStart(ch: string): boolean {
  return (
    ch === "_" ||
    ch === "@" ||
    ch === "`" ||
    (ch >= "A" && ch <= "Z") ||
    (ch >= "a" && ch <= "z")
  );
}

/**
 * Tests if a character can be the continuation of an identifier
 * @param ch Character to test
 */
function isIdContinuation(ch: string): boolean {
  return (
    ch === "_" ||
    ch === "@" ||
    ch === "!" ||
    ch === "?" ||
    ch === "#" ||
    isLetterOrDigit(ch)
  );
}

/**
 * Tests if a character can be the suffix of a hexadecimal literal
 * @param ch Character to test
 */
function isHexaSuffix(ch: string | null): boolean {
  return ch === "h" || ch === "H";
}

/**
 * Tests if a character can be the suffix of an octal literal
 * @param ch Character to test
 */
function isOctalSuffix(ch: string | null): boolean {
  return ch === "o" || ch === "O" || ch === "q" || ch === "Q";
}

/**
 * Tests if a character is restricted in a string
 * @param ch Character to test
 */
function isRestrictedInString(ch: string): boolean {
  return (
    ch === "\r" ||
    ch === "\n" ||
    ch === "\u0085" ||
    ch === "\u2028" ||
    ch === "\u2029"
  );
}

// A hash of keyword-like tokens starting with a dot
const resolverHash: { [key: string]: TokenType } = {
  a: TokenType.A,
  A: TokenType.A,
  b: TokenType.B,
  B: TokenType.B,
  c: TokenType.C,
  C: TokenType.C,
  d: TokenType.D,
  D: TokenType.D,
  e: TokenType.E,
  E: TokenType.E,
  h: TokenType.H,
  H: TokenType.H,
  l: TokenType.L,
  L: TokenType.L,
  i: TokenType.I,
  I: TokenType.I,
  r: TokenType.R,
  R: TokenType.R,
  xl: TokenType.XL,
  XL: TokenType.XL,
  ixl: TokenType.XL,
  IXL: TokenType.XL,
  IXl: TokenType.XL,
  yl: TokenType.YL,
  YL: TokenType.YL,
  iyl: TokenType.YL,
  IYL: TokenType.YL,
  IYl: TokenType.YL,

  bc: TokenType.BC,
  BC: TokenType.BC,
  de: TokenType.DE,
  DE: TokenType.DE,
  hl: TokenType.HL,
  HL: TokenType.HL,
  sp: TokenType.SP,
  SP: TokenType.SP,
  ix: TokenType.IX,
  IX: TokenType.IX,
  iy: TokenType.IY,
  IY: TokenType.IY,
  af: TokenType.AF,
  AF: TokenType.AF,
  "af'": TokenType.AF_,
  "AF'": TokenType.AF_,

  z: TokenType.Z,
  Z: TokenType.Z,
  nz: TokenType.NZ,
  NZ: TokenType.NZ,
  nc: TokenType.NC,
  NC: TokenType.NC,
  po: TokenType.PO,
  PO: TokenType.PO,
  pe: TokenType.PE,
  PE: TokenType.PE,
  p: TokenType.P,
  P: TokenType.P,
  m: TokenType.M,
  M: TokenType.M,

  nop: TokenType.Nop,
  NOP: TokenType.Nop,
  rlca: TokenType.Rlca,
  RLCA: TokenType.Rlca,
  rrca: TokenType.Rrca,
  RRCA: TokenType.Rrca,
  rla: TokenType.Rla,
  RLA: TokenType.Rla,
  rra: TokenType.Rra,
  RRA: TokenType.Rra,
  cpl: TokenType.Cpl,
  CPL: TokenType.Cpl,
  scf: TokenType.Scf,
  SCF: TokenType.Scf,
  halt: TokenType.Halt,
  HALT: TokenType.Halt,
  ret: TokenType.Ret,
  RET: TokenType.Ret,
  exx: TokenType.Exx,
  EXX: TokenType.Exx,
  di: TokenType.Di,
  DI: TokenType.Di,
  ei: TokenType.Ei,
  EI: TokenType.Ei,
  neg: TokenType.Neg,
  NEG: TokenType.Neg,
  retn: TokenType.Retn,
  RETN: TokenType.Retn,
  reti: TokenType.Reti,
  RETI: TokenType.Reti,
  rld: TokenType.Rld,
  RLD: TokenType.Rld,
  rrd: TokenType.Rrd,
  RRD: TokenType.Rrd,
  ldi: TokenType.Ldi,
  LDI: TokenType.Ldi,
  cpi: TokenType.Cpi,
  CPI: TokenType.Cpi,
  ini: TokenType.Ini,
  INI: TokenType.Ini,
  outi: TokenType.Outi,
  OUTI: TokenType.Outi,
  ldd: TokenType.Ldd,
  LDD: TokenType.Ldd,
  cpd: TokenType.Cpd,
  CPD: TokenType.Cpd,
  ind: TokenType.Ind,
  IND: TokenType.Ind,
  outd: TokenType.Outd,
  OUTD: TokenType.Outd,
  ldir: TokenType.Ldir,
  LDIR: TokenType.Ldir,
  cpir: TokenType.Cpir,
  CPIR: TokenType.Cpir,
  inir: TokenType.Inir,
  INIR: TokenType.Inir,
  otir: TokenType.Otir,
  OTIR: TokenType.Otir,
  lddr: TokenType.Lddr,
  LDDR: TokenType.Lddr,
  cpdr: TokenType.Cpdr,
  CPDR: TokenType.Cpdr,
  indr: TokenType.Indr,
  INDR: TokenType.Indr,
  otdr: TokenType.Otdr,
  OTDR: TokenType.Otdr,

  ld: TokenType.Ld,
  LD: TokenType.Ld,
  inc: TokenType.Inc,
  INC: TokenType.Inc,
  dec: TokenType.Dec,
  DEC: TokenType.Dec,
  ex: TokenType.Ex,
  EX: TokenType.Ex,
  add: TokenType.Add,
  ADD: TokenType.Add,
  adc: TokenType.Adc,
  ADC: TokenType.Adc,
  sub: TokenType.Sub,
  SUB: TokenType.Sub,
  sbc: TokenType.Sbc,
  SBC: TokenType.Sbc,
  and: TokenType.And,
  AND: TokenType.And,
  xor: TokenType.Xor,
  XOR: TokenType.Xor,
  or: TokenType.Or,
  OR: TokenType.Or,
  cp: TokenType.Cp,
  CP: TokenType.Cp,
  djnz: TokenType.Djnz,
  DJNZ: TokenType.Djnz,
  jr: TokenType.Jr,
  JR: TokenType.Jr,
  jp: TokenType.Jp,
  JP: TokenType.Jp,
  call: TokenType.Call,
  CALL: TokenType.Call,
  rst: TokenType.Rst,
  RST: TokenType.Rst,
  push: TokenType.Push,
  PUSH: TokenType.Push,
  pop: TokenType.Pop,
  POP: TokenType.Pop,
  in: TokenType.In,
  IN: TokenType.In,
  out: TokenType.Out,
  OUT: TokenType.Out,
  im: TokenType.Im,
  IM: TokenType.Im,
  rlc: TokenType.Rlc,
  RLC: TokenType.Rlc,
  rrc: TokenType.Rrc,
  RRC: TokenType.Rrc,
  rl: TokenType.Rl,
  RL: TokenType.Rl,
  rr: TokenType.Rr,
  RR: TokenType.Rr,
  sla: TokenType.Sla,
  SLA: TokenType.Sla,
  sra: TokenType.Sra,
  SRA: TokenType.Sra,
  sll: TokenType.Sll,
  SLL: TokenType.Sll,
  srl: TokenType.Srl,
  SRL: TokenType.Srl,
  bit: TokenType.Bit,
  BIT: TokenType.Bit,
  set: TokenType.Set,
  SET: TokenType.Set,
  res: TokenType.Res,
  RES: TokenType.Res,

  swapnib: TokenType.Swapnib,
  SWAPNIB: TokenType.Swapnib,
  mirror: TokenType.Mirror,
  MIRROR: TokenType.Mirror,
  test: TokenType.Test,
  TEST: TokenType.Test,
  bsla: TokenType.Bsla,
  BSLA: TokenType.Bsla,
  bsra: TokenType.Bsra,
  BSRA: TokenType.Bsra,
  bsrl: TokenType.Bsrl,
  BSRL: TokenType.Bsrl,
  bsrf: TokenType.Bsrf,
  BSRF: TokenType.Bsrf,
  brlc: TokenType.Brlc,
  BRLC: TokenType.Brlc,
  mul: TokenType.Mul,
  MUL: TokenType.Mul,
  outinb: TokenType.OutInB,
  OUTINB: TokenType.OutInB,
  nextreg: TokenType.NextReg,
  NEXTREG: TokenType.NextReg,
  pixeldn: TokenType.PixelDn,
  PIXELDN: TokenType.PixelDn,
  pixelad: TokenType.PixelAd,
  PIXELAD: TokenType.PixelAd,
  setae: TokenType.SetAE,
  SETAE: TokenType.SetAE,
  ldix: TokenType.Ldix,
  LDIX: TokenType.Ldix,
  ldws: TokenType.Ldws,
  LDWS: TokenType.Ldws,
  lddx: TokenType.Lddx,
  LDDX: TokenType.Lddx,
  ldirx: TokenType.Ldirx,
  LDIRX: TokenType.Ldirx,
  ldpirx: TokenType.Ldpirx,
  LDPIRX: TokenType.Ldpirx,
  lddrx: TokenType.Lddrx,
  LDDRX: TokenType.Lddrx,

  ".org": TokenType.Org,
  ".ORG": TokenType.Org,
  org: TokenType.Org,
  ORG: TokenType.Org,

  ".xorg": TokenType.Xorg,
  ".XORG": TokenType.Xorg,
  xorg: TokenType.Xorg,
  XORG: TokenType.Xorg,

  ".ent": TokenType.Ent,
  ".ENT": TokenType.Ent,
  ent: TokenType.Ent,
  ENT: TokenType.Ent,

  ".xent": TokenType.Xent,
  ".XENT": TokenType.Xent,
  xent: TokenType.Xent,
  XENT: TokenType.Xent,

  ".equ": TokenType.Equ,
  ".EQU": TokenType.Equ,
  equ: TokenType.Equ,
  EQU: TokenType.Equ,

  ".var": TokenType.Var,
  ".VAR": TokenType.Var,
  var: TokenType.Var,
  VAR: TokenType.Var,

  ".disp": TokenType.Disp,
  ".DISP": TokenType.Disp,
  disp: TokenType.Disp,
  DISP: TokenType.Disp,

  ".defb": TokenType.Defb,
  ".DEFB": TokenType.Defb,
  defb: TokenType.Defb,
  DEFB: TokenType.Defb,
  ".db": TokenType.Defb,
  ".DB": TokenType.Defb,
  db: TokenType.Defb,
  DB: TokenType.Defb,

  ".defw": TokenType.Defw,
  ".DEFW": TokenType.Defw,
  defw: TokenType.Defw,
  DEFW: TokenType.Defw,
  ".dw": TokenType.Defw,
  ".DW": TokenType.Defw,
  dw: TokenType.Defw,
  DW: TokenType.Defw,

  ".defm": TokenType.Defm,
  ".DEFM": TokenType.Defm,
  defm: TokenType.Defm,
  DEFM: TokenType.Defm,
  ".dm": TokenType.Defm,
  ".DM": TokenType.Defm,
  dm: TokenType.Defm,
  DM: TokenType.Defm,

  ".defn": TokenType.Defn,
  ".DEFN": TokenType.Defn,
  defn: TokenType.Defn,
  DEFN: TokenType.Defn,
  ".dn": TokenType.Defn,
  ".DN": TokenType.Defn,
  dn: TokenType.Defn,
  DN: TokenType.Defn,

  ".defh": TokenType.Defh,
  ".DEFH": TokenType.Defh,
  defh: TokenType.Defh,
  DEFH: TokenType.Defh,
  ".dh": TokenType.Defh,
  ".DH": TokenType.Defh,
  dh: TokenType.Defh,
  DH: TokenType.Defh,

  ".defgx": TokenType.Defgx,
  ".DEFGX": TokenType.Defgx,
  defgx: TokenType.Defgx,
  DEFGX: TokenType.Defgx,
  ".dgx": TokenType.Defgx,
  ".DGX": TokenType.Defgx,
  dgx: TokenType.Defgx,
  DGX: TokenType.Defgx,

  ".defg": TokenType.Defg,
  ".DEFG": TokenType.Defg,
  defg: TokenType.Defg,
  DEFG: TokenType.Defg,
  ".dg": TokenType.Defg,
  ".DG": TokenType.Defg,
  dg: TokenType.Defg,
  DG: TokenType.Defg,

  ".defc": TokenType.Defc,
  ".DEFC": TokenType.Defc,
  defc: TokenType.Defc,
  DEFC: TokenType.Defc,
  ".dc": TokenType.Defc,
  ".DC": TokenType.Defc,
  dc: TokenType.Defc,
  DC: TokenType.Defc,

  ".skip": TokenType.Skip,
  ".SKIP": TokenType.Skip,
  skip: TokenType.Skip,
  SKIP: TokenType.Skip,

  ".extern": TokenType.Extern,
  ".EXTERN": TokenType.Extern,
  extern: TokenType.Extern,
  EXTERN: TokenType.Extern,

  ".defs": TokenType.Defs,
  ".DEFS": TokenType.Defs,
  defs: TokenType.Defs,
  DEFS: TokenType.Defs,
  ".ds": TokenType.Defs,
  ".DS": TokenType.Defs,
  ds: TokenType.Defs,
  DS: TokenType.Defs,

  ".fillb": TokenType.Fillb,
  ".FILLB": TokenType.Fillb,
  fillb: TokenType.Fillb,
  FILLB: TokenType.Fillb,

  ".fillw": TokenType.Fillw,
  ".FILLW": TokenType.Fillw,
  fillw: TokenType.Fillw,
  FILLW: TokenType.Fillw,

  ".model": TokenType.Model,
  ".MODEL": TokenType.Model,
  model: TokenType.Model,
  MODEL: TokenType.Model,

  ".align": TokenType.Align,
  ".ALIGN": TokenType.Align,
  align: TokenType.Align,
  ALIGN: TokenType.Align,

  ".trace": TokenType.Trace,
  ".TRACE": TokenType.Trace,
  trace: TokenType.Trace,
  TRACE: TokenType.Trace,

  ".tracehex": TokenType.TraceHex,
  ".TRACEHEX": TokenType.TraceHex,
  tracehex: TokenType.TraceHex,
  TRACEHEX: TokenType.TraceHex,

  ".rndseed": TokenType.RndSeed,
  ".RNDSEED": TokenType.RndSeed,
  rndseed: TokenType.RndSeed,
  RNDSEED: TokenType.RndSeed,

  ".error": TokenType.Error,
  ".ERROR": TokenType.Error,
  error: TokenType.Error,
  ERROR: TokenType.Error,

  ".includebin": TokenType.IncludeBin,
  ".INCLUDEBIN": TokenType.IncludeBin,
  ".include_bin": TokenType.IncludeBin,
  ".INCLUDE_BIN": TokenType.IncludeBin,
  includebin: TokenType.IncludeBin,
  INCLUDEBIN: TokenType.IncludeBin,
  include_bin: TokenType.IncludeBin,
  INCLUDE_BIN: TokenType.IncludeBin,

  ".comparebin": TokenType.CompareBin,
  ".COMPAREBIN": TokenType.CompareBin,
  comparebin: TokenType.CompareBin,
  COMPAREBIN: TokenType.CompareBin,

  ".macro": TokenType.Macro,
  ".MACRO": TokenType.Macro,
  macro: TokenType.Macro,
  MACRO: TokenType.Macro,

  ".endm": TokenType.Endm,
  ".ENDM": TokenType.Endm,
  endm: TokenType.Endm,
  ENDM: TokenType.Endm,
  ".mend": TokenType.Endm,
  ".MEND": TokenType.Endm,
  mend: TokenType.Endm,
  MEND: TokenType.Endm,

  ".proc": TokenType.Proc,
  ".PROC": TokenType.Proc,
  proc: TokenType.Proc,
  PROC: TokenType.Proc,

  ".endp": TokenType.Endp,
  ".ENDP": TokenType.Endp,
  endp: TokenType.Endp,
  ENDP: TokenType.Endp,
  ".pend": TokenType.Endp,
  ".PEND": TokenType.Endp,
  pend: TokenType.Endp,
  PEND: TokenType.Endp,

  ".loop": TokenType.Loop,
  ".LOOP": TokenType.Loop,
  loop: TokenType.Loop,
  LOOP: TokenType.Loop,

  ".endl": TokenType.Endl,
  ".ENDL": TokenType.Endl,
  endl: TokenType.Endl,
  ENDL: TokenType.Endl,
  ".lend": TokenType.Endl,
  ".LEND": TokenType.Endl,
  lend: TokenType.Endl,
  LEND: TokenType.Endl,

  ".repeat": TokenType.Repeat,
  ".REPEAT": TokenType.Repeat,
  repeat: TokenType.Repeat,
  REPEAT: TokenType.Repeat,

  ".until": TokenType.Until,
  ".UNTIL": TokenType.Until,
  until: TokenType.Until,
  UNTIL: TokenType.Until,

  ".while": TokenType.While,
  ".WHILE": TokenType.While,
  while: TokenType.While,
  WHILE: TokenType.While,

  ".endw": TokenType.Endw,
  ".ENDW": TokenType.Endw,
  endw: TokenType.Endw,
  ENDW: TokenType.Endw,
  ".wend": TokenType.Endw,
  ".WEND": TokenType.Endw,
  wend: TokenType.Endw,
  WEND: TokenType.Endw,

  ".if": TokenType.If,
  ".IF": TokenType.If,
  if: TokenType.If,
  IF: TokenType.If,

  ".ifused": TokenType.IfUsed,
  ".IFUSED": TokenType.IfUsed,
  ifused: TokenType.IfUsed,
  IFUSED: TokenType.IfUsed,

  ".ifnused": TokenType.IfNUsed,
  ".IFNUSED": TokenType.IfNUsed,
  ifnused: TokenType.IfNUsed,
  IFNUSED: TokenType.IfNUsed,

  ".elif": TokenType.Elif,
  ".ELIF": TokenType.Elif,
  elif: TokenType.Elif,
  ELIF: TokenType.Elif,

  ".else": TokenType.Else,
  ".ELSE": TokenType.Else,
  else: TokenType.Else,
  ELSE: TokenType.Else,

  ".endif": TokenType.Endif,
  ".ENDIF": TokenType.Endif,
  endif: TokenType.Endif,
  ENDIF: TokenType.Endif,

  ".for": TokenType.For,
  ".FOR": TokenType.For,
  for: TokenType.For,
  FOR: TokenType.For,

  ".to": TokenType.To,
  ".TO": TokenType.To,
  to: TokenType.To,
  TO: TokenType.To,

  ".step": TokenType.Step,
  ".STEP": TokenType.Step,
  step: TokenType.Step,
  STEP: TokenType.Step,

  ".next": TokenType.Next,
  ".NEXT": TokenType.Next,
  next: TokenType.Next,
  NEXT: TokenType.Next,

  ".break": TokenType.Break,
  ".BREAK": TokenType.Break,
  break: TokenType.Break,
  BREAK: TokenType.Break,

  ".continue": TokenType.Continue,
  ".CONTINUE": TokenType.Continue,
  continue: TokenType.Continue,
  CONTINUE: TokenType.Continue,

  ".module": TokenType.Module,
  ".MODULE": TokenType.Module,
  module: TokenType.Module,
  MODULE: TokenType.Module,
  ".scope": TokenType.Module,
  ".SCOPE": TokenType.Module,
  scope: TokenType.Module,
  SCOPE: TokenType.Module,

  ".endmodule": TokenType.EndModule,
  ".ENDMODULE": TokenType.EndModule,
  endmodule: TokenType.EndModule,
  ENDMODULE: TokenType.EndModule,
  ".endscope": TokenType.EndModule,
  ".ENDSCOPE": TokenType.EndModule,
  endscope: TokenType.EndModule,
  ENDSCOPE: TokenType.EndModule,
  ".moduleend": TokenType.EndModule,
  ".MODULEEND": TokenType.EndModule,
  moduleend: TokenType.EndModule,
  MODULEEND: TokenType.EndModule,
  ".scopeend": TokenType.EndModule,
  ".SCOPEEND": TokenType.EndModule,
  scopeend: TokenType.EndModule,
  SCOPEEND: TokenType.EndModule,

  ".struct": TokenType.Struct,
  ".STRUCT": TokenType.Struct,
  struct: TokenType.Struct,
  STRUCT: TokenType.Struct,

  ".ends": TokenType.Ends,
  ".ENDS": TokenType.Ends,
  ends: TokenType.Ends,
  ENDS: TokenType.Ends,

  textof: TokenType.TextOf,
  TEXTOF: TokenType.TextOf,

  ltextof: TokenType.LTextOf,
  LTEXTOF: TokenType.LTextOf,

  hreg: TokenType.HReg,
  HREG: TokenType.HReg,

  lreg: TokenType.LReg,
  LREG: TokenType.LReg,

  def: TokenType.Def,
  DEF: TokenType.Def,

  isreg8: TokenType.IsReg8,
  ISREG8: TokenType.IsReg8,

  isreg8std: TokenType.IsReg8Std,
  ISREG8STD: TokenType.IsReg8Std,

  isreg8spec: TokenType.IsReg8Spec,
  ISREG8SPEC: TokenType.IsReg8Spec,

  isreg8idx: TokenType.IsReg8Idx,
  ISREG8IDX: TokenType.IsReg8Idx,

  isreg16: TokenType.IsReg16,
  ISREG16: TokenType.IsReg16,

  isreg16std: TokenType.IsReg16Std,
  ISREG16STD: TokenType.IsReg16Std,

  isreg16idx: TokenType.IsReg16Idx,
  ISREG16IDX: TokenType.IsReg16Idx,

  isregindirect: TokenType.IsRegIndirect,
  ISREGINDIRECT: TokenType.IsRegIndirect,

  iscport: TokenType.IsCPort,
  ISCPORT: TokenType.IsCPort,

  isindexedaddr: TokenType.IsIndexedAddr,
  ISINDEXEDADDR: TokenType.IsIndexedAddr,

  iscondition: TokenType.IsCondition,
  ISCONDITION: TokenType.IsCondition,

  isexpr: TokenType.IsExpr,
  ISEXPR: TokenType.IsExpr,

  ".true": TokenType.True,
  ".TRUE": TokenType.True,
  true: TokenType.True,
  TRUE: TokenType.True,

  ".false": TokenType.False,
  ".FALSE": TokenType.False,
  false: TokenType.False,
  FALSE: TokenType.False,

  ".cnt": TokenType.CurCnt,
  ".CNT": TokenType.CurCnt,
  $cnt: TokenType.CurCnt,
  $CNT: TokenType.CurCnt,

  "#ifdef": TokenType.IfDefDir,
  "#ifndef": TokenType.IfNDefDir,
  "#endif": TokenType.EndIfDir,
  "#else": TokenType.ElseDir,
  "#define": TokenType.DefineDir,
  "#undef": TokenType.UndefDir,
  "#include": TokenType.IncludeDir,
  "#if": TokenType.IfDir,
  "#ifmod": TokenType.IfModDir,
  "#ifnmod": TokenType.IfNModDir,
};
