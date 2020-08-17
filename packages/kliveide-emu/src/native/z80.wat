;; ==========================================================================
;; Z80 CPU core

;; ==========================================================================
;; Z80 CPU state

;; CPU registers
(global $PC (mut i32) (i32.const 0x00))
(global $SP (mut i32) (i32.const 0x00))

;; Once-set
(global $tactsInFrame (mut i32) (i32.const 1_000_000)) ;; Number of tacts within a frame
(global $allowExtendedSet (mut i32) (i32.const 0x00))  ;; Should allow extended operation set?

;; Mutable
(global $tacts (mut i32) (i32.const 0x0000)) ;; CPU tacts since starting the cpu
(global $stateFlags (mut i32) (i32.const 0x00)) ;; Z80 state flags
(global $useGateArrayContention (mut i32) (i32.const 0x0000)) ;; Should use gate array contention?
(global $iff1 (mut i32) (i32.const 0x00)) ;; Interrupt flip-flop #1
(global $iff2 (mut i32) (i32.const 0x00)) ;; Interrupt flip-flop #2
(global $interruptMode (mut i32) (i32.const 0x00)) ;; Current interrupt mode
(global $isInterruptBlocked (mut i32) (i32.const 0x00)) ;; Current interrupt block
(global $isInOpExecution (mut i32) (i32.const 0x00)) ;; Is currently processing an op?
(global $prefixMode (mut i32) (i32.const 0x00)) ;; Current operation prefix mode
(global $indexMode (mut i32) (i32.const 0x00)) ;; Current operation index mode
(global $maskableInterruptModeEntered (mut i32) (i32.const 0x00)) ;; Signs that CPU entered into maskable interrupt mode
(global $opCode (mut i32) (i32.const 0x00)) ;; Operation code being processed

;; Writes the CPU state to the transfer area
(func $getCpuState
  ;; Registers
  (i32.store8 offset=0 (get_global $STATE_TRANSFER_BUFF) (call $getF))
  (i32.store8 offset=1 (get_global $STATE_TRANSFER_BUFF) (call $getA))

  (i32.store16 offset=18 (get_global $STATE_TRANSFER_BUFF) (get_global $PC))
  (i32.store16 offset=20 (get_global $STATE_TRANSFER_BUFF) (get_global $SP))

  ;; Other CPU state variables
  (i32.store offset=28 (get_global $STATE_TRANSFER_BUFF) (get_global $tactsInFrame))
  (i32.store8 offset=32 (get_global $STATE_TRANSFER_BUFF) (get_global $allowExtendedSet))
  (i32.store offset=33 (get_global $STATE_TRANSFER_BUFF) (get_global $tacts))
  (i32.store8 offset=37 (get_global $STATE_TRANSFER_BUFF) (get_global $stateFlags))
  (i32.store8 offset=38 (get_global $STATE_TRANSFER_BUFF) (get_global $useGateArrayContention))
  (i32.store8 offset=39 (get_global $STATE_TRANSFER_BUFF) (get_global $iff1))
  (i32.store8 offset=40 (get_global $STATE_TRANSFER_BUFF) (get_global $iff2))
  (i32.store8 offset=41 (get_global $STATE_TRANSFER_BUFF) (get_global $interruptMode))
  (i32.store8 offset=42 (get_global $STATE_TRANSFER_BUFF) (get_global $isInterruptBlocked))
  (i32.store8 offset=43 (get_global $STATE_TRANSFER_BUFF) (get_global $isInOpExecution))
  (i32.store8 offset=44 (get_global $STATE_TRANSFER_BUFF) (get_global $prefixMode))
  (i32.store8 offset=45 (get_global $STATE_TRANSFER_BUFF) (get_global $indexMode))
  (i32.store8 offset=46 (get_global $STATE_TRANSFER_BUFF) (get_global $maskableInterruptModeEntered))
  (i32.store8 offset=47 (get_global $STATE_TRANSFER_BUFF) (get_global $opCode))
)

;; Restores the CPU state from the transfer area
(func $updateCpuState
  ;; Registers
  (call $setF (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=0))
  (call $setA (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=1))

  (set_global $PC (get_global $STATE_TRANSFER_BUFF) (i32.load16_u offset=18))
  (set_global $SP (get_global $STATE_TRANSFER_BUFF) (i32.load16_u offset=20))

  ;; Other CPU state variables
  (set_global $tactsInFrame (get_global $STATE_TRANSFER_BUFF) (i32.load offset=28))
  (set_global $allowExtendedSet (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=32))
  (set_global $tacts (get_global $STATE_TRANSFER_BUFF) (i32.load offset=33))
  (set_global $stateFlags (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=37))
  (set_global $useGateArrayContention (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=38))
  (set_global $iff1 (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=39))
  (set_global $iff2 (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=40))
  (set_global $interruptMode (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=41))
  (set_global $isInterruptBlocked (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=42))
  (set_global $isInOpExecution (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=43))
  (set_global $prefixMode (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=44))
  (set_global $indexMode (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=45))
  (set_global $maskableInterruptModeEntered (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=46))
  (set_global $opCode (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=47))
)

;; Represents a no-operation function
(func $NOOP)

;; ==========================================================================
;; Z80 CPU registers access

;; Gets the value of A
(func $getA (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=1
)

;; Sets the value of A
(func $setA (param $v i32)
  (i32.store8 offset=1 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of F
(func $getF (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=0
)

;; Sets the value of F
(func $setF (param $v i32)
  (i32.store8 offset=0 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of AF
(func $getAF (result i32)
  get_global $REG_AREA_INDEX i32.load16_u offset=0
)

;; Sets the value of AF
(func $setAF (param $v i32)
  (i32.store16 offset=0 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of B
(func $getB (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=3
)

;; Sets the value of B
(func $setB (param $v i32)
  (i32.store8 offset=3 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of C
(func $getC (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=2
)

;; Sets the value of C
(func $setC (param $v i32)
  (i32.store8 offset=2 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of BC
(func $getBC (result i32)
  get_global $REG_AREA_INDEX i32.load16_u offset=2
)

;; Sets the value of BC
(func $setBC (param $v i32)
  (i32.store16 offset=2 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of D
(func $getD (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=5
)

;; Sets the value of D
(func $setD (param $v i32)
  (i32.store8 offset=5 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of E
(func $getE (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=4
)

;; Sets the value of E
(func $setE (param $v i32)
  (i32.store8 offset=4 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of DE
(func $getDE (result i32)
  get_global $REG_AREA_INDEX i32.load16_u offset=4
)

;; Sets the value of DE
(func $setDE (param $v i32)
  (i32.store16 offset=4 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of H
(func $getH (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=7
)

;; Sets the value of H
(func $setH (param $v i32)
  (i32.store8 offset=7 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of L
(func $getL (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=6
)

;; Sets the value of L
(func $setL (param $v i32)
  (i32.store8 offset=6 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of HL
(func $getHL (result i32)
  get_global $REG_AREA_INDEX i32.load16_u offset=6
)

;; Sets the value of HL
(func $setHL (param $v i32)
  (i32.store16 offset=6 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of I
(func $getI (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=16
)

;; Sets the value of I
(func $setI (param $v i32)
  (i32.store8 offset=16 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of R
(func $getR (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=17
)

;; Sets the value of R
(func $setR (param $v i32)
  (i32.store8 offset=17 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Sets the value of PC
(func $setPC (param $v i32)
  (set_global $PC (i32.and (get_local $v) (i32.const 0xffff)))
)

;; Sets the value of SP
(func $setSP (param $v i32)
  (set_global $SP (i32.and (get_local $v) (i32.const 0xffff)))
)

;; Gets the value of XH
(func $getXH (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=23
)

;; Sets the value of XH
(func $setXH (param $v i32)
  (i32.store8 offset=23 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of XL
(func $getXL (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=22
)

;; Sets the value of XL
(func $setXL (param $v i32)
  (i32.store8 offset=22 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of IX
(func $getIX (result i32)
  get_global $REG_AREA_INDEX i32.load16_u offset=22
)

;; Sets the value of IX
(func $setIX (param $v i32)
  (i32.store16 offset=22 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of YH
(func $getYH (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=25
)

;; Sets the value of YH
(func $setYH (param $v i32)
  (i32.store8 offset=25 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of YL
(func $getYL (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=24
)

;; Sets the value of YL
(func $setYL (param $v i32)
  (i32.store8 offset=24 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of IY
(func $getIY (result i32)
  get_global $REG_AREA_INDEX i32.load16_u offset=24
)

;; Sets the value of IY
(func $setIY (param $v i32)
  (i32.store16 offset=24 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of WH
(func $getWH (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=27
)

;; Sets the value of WH
(func $setWH (param $v i32)
  (i32.store8 offset=27 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of WL
(func $getWL (result i32)
  get_global $REG_AREA_INDEX i32.load8_u offset=26
)

;; Sets the value of WL
(func $setWL (param $v i32)
  (i32.store8 offset=26 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the value of WZ
(func $getWZ (result i32)
  get_global $REG_AREA_INDEX i32.load16_u offset=26
)

;; Sets the value of WZ
(func $setWZ (param $v i32)
  (i32.store16 offset=26 (get_global $REG_AREA_INDEX) (get_local $v))
)

;; Gets the specified 8-bit register
;; $r: Register index from 0-7: B, C, D, E, H, L, F, A
;; returns: 8-bit register value
(func $getReg8 (param $r i32) (result i32)
  (i32.eq (get_local $r) (i32.const 0x07))
  if
    call $getA
    return
  end

  get_global $REG_AREA_INDEX

  ;; Convert 8-bit register index to offset
  get_global $REG8_TAB_OFFS
  (i32.and (get_local $r) (i32.const 0x07))
  i32.add
  i32.load8_u

  ;; Load 8-bit register from memory
  i32.add
  i32.load8_u
)

;; Sets the specified 8-bit register
;; $r: Register index from 0-7: B, C, D, E, H, L, F, A
(func $setReg8 (param $r i32) (param $v i32)
  (i32.eq (get_local $r) (i32.const 0x07))
  if
    get_local $v
    (call $setA (i32.and (i32.const 0xff)))
    return
  end

  get_global $REG_AREA_INDEX

  ;; Convert 8-bit register index to offset
  get_global $REG8_TAB_OFFS
  (i32.and (get_local $r) (i32.const 0x07))
  i32.add
  i32.load8_u

  ;; Store register to memory
  i32.add
  get_local $v
  i32.store8
)

;; Gets the specified 16-bit register
;; $r: Register index from 0-3: BC, DE, HL, SP
;; returns: 8-bit register value
(func $getReg16 (param $r i32) (result i32)
  get_global $REG_AREA_INDEX
  
  ;; Convert 16-bit register index to offset
  get_global $REG16_TAB_OFFS
  (i32.and (get_local $r) (i32.const 0x03))
  i32.add
  i32.load8_u

  ;; Load register from memory
  i32.add
  i32.load16_u
)

;; Sets the specified 16-bit register
;; $r: Register index from 0-3: BC, DE, HL, SP
(func $setReg16 (param $r i32) (param $v i32)
  get_global $REG_AREA_INDEX
  
  ;; Convert 16-bit register index to offset
  get_global $REG16_TAB_OFFS
  (i32.and (get_local $r) (i32.const 0x03))
  i32.add
  i32.load8_u

  ;; Store register tomemory
  i32.add
  get_local $v
  i32.store16
)

;; Sets the current index mode
;; $im: Index mode: 1: IX; other: IY
(func $setIndexMode (param $im i32)
  get_local $im
  set_global $indexMode
)

;; Gets the value of the index register according to the current indexing mode
(func $getIndexReg (result i32)
  get_global $indexMode
  i32.const 1
  i32.eq
  if (result i32)
    get_global $REG_AREA_INDEX i32.load16_u offset=22 ;; IX
  else
    get_global $REG_AREA_INDEX i32.load16_u offset=24 ;; IY
  end
)

;; Sets the value of the index register according to the current indexing mode
;; $v: 16-bit index register value
(func $setIndexReg (param $v i32)
  get_global $indexMode
  i32.const 1
  i32.eq
  if
    (i32.store16 offset=22 (get_global $REG_AREA_INDEX) (get_local $v)) ;; IX
  else
    (i32.store16 offset=24 (get_global $REG_AREA_INDEX) (get_local $v)) ;; IY
  end
)

;; ==========================================================================
;; Z80 clock management

;; Increments the current frame tact with the specified value
;; $inc: Increment
(func $incTacts (param $inc i32)
  (i32.add (get_global $tacts) (get_local $inc))
  set_global $tacts
)

;; ==========================================================================
;; Z80 CPU life cycle methods

;; Turns on the CPU
(func $turnOnCpu
  i32.const 0xff call $setA
  i32.const 0xff call $setF
  i32.const 0xffff set_global $PC
  i32.const 0xffff set_global $SP
  (i32.store16 offset=0 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
  (i32.store16 offset=2 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
  (i32.store16 offset=4 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
  (i32.store16 offset=6 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
  (i32.store16 offset=8 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
  (i32.store16 offset=10 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
  (i32.store16 offset=12 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
  (i32.store16 offset=14 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
  (i32.store16 offset=16 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
  (i32.store16 offset=18 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
  (i32.store16 offset=20 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
  (i32.store16 offset=22 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
  (i32.store16 offset=24 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
  (i32.store16 offset=26 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
  i32.const 0x0000 set_global $tacts
  i32.const 0x0000 set_global $stateFlags
  i32.const 0x0000 set_global $useGateArrayContention
  i32.const 0x0000 set_global $iff1
  i32.const 0x0000 set_global $iff2
  i32.const 0x0000 set_global $interruptMode
  i32.const 0x0000 set_global $isInterruptBlocked
  i32.const 0x0000 set_global $isInOpExecution
  i32.const 0x0000 set_global $prefixMode
  i32.const 0x0000 set_global $indexMode
  i32.const 0x0000 set_global $maskableInterruptModeEntered
  i32.const 0x0000 set_global $opCode
)

;; Enables/disables extended instruction set
;; $f: True, enable; false, disable
(func $enableExtendedInstructions (param $f i32)
  get_local $f
  set_global $allowExtendedSet
)

;; ==========================================================================
;; Z80 Memory access

;; Default memory read operation
;; $addr: 16-bit memory address
;; returns: Memory contents
(func $defaultRead (param $addr i32) (result i32)
  (i32.add (get_local $addr) (get_global $SP_MEM_OFFS))
  i32.load8_u
)

;; Default memory write operation
;; $addr: 16-bit memory address
;; $v: 8-bit value to write
(func $defaultWrite (param $addr i32) (param $v i32)
  (i32.add (get_local $addr) (get_global $SP_MEM_OFFS))
  get_local $v
  i32.store8
)

;; Default I/O read operation
;; $addr: 16-bit memory address
;; returns: Memory contents
(func $defaultIoRead (param $addr i32) (result i32)
  i32.const 0xff
)

;; Default I/O write operation
;; $addr: 16-bit memory address
;; $v: 8-bit value to write
(func $defaultIoWrite (param $addr i32) (param $v i32)
  (call $incTacts (i32.const 4))
)

;; Reads the specified memory location of the current machine type
;; $addr: 16-bit memory address
;; returns: Memory contents
(func $readMemory (param $addr i32) (result i32)
  get_local $addr
  (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
  call_indirect (type $MemReadFunc)
  (call $incTacts (i32.const 3))
)

;; Reads the specified memory location of the current machine type
;; $addr: 16-bit memory address
;; returns: Memory contents
(func $readMemoryNc (param $addr i32) (result i32)
  get_local $addr
  (i32.add
    (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
    (i32.const 1)
  )
  call_indirect (type $MemReadFunc)
)

;; Reads the specified memory location of the current machine type
;; but with no extra delay applies
;; $addr: 16-bit memory address
(func $memoryDelay (param $addr i32)
  get_local $addr
  (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
  call_indirect (type $MemReadFunc)
  drop
)

;; Writes the specified memory location of the current machine type
;; $addr: 16-bit memory address
;; $v: 8-bit value to write
(func $writeMemory (param $addr i32) (param $v i32)
  get_local $addr
  get_local $v
  (i32.add
    (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
    (i32.const 2)
  )
  call_indirect (type $MemWriteFunc)
  (call $incTacts (i32.const 3))
  (call $setMemoryWritePoint (get_local $addr))
)

;; Reads the specified I/O port of the current machine type
;; $addr: 16-bit port address
;; returns: Port value
(func $readPort (param $addr i32) (result i32)
  get_local $addr
  (i32.add
    (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
    (i32.const 3)
  )
  call_indirect (type $PortReadFunc)
  (call $incTacts (i32.const 4))
)

;; Writes the specified port of the current machine type
;; $addr: 16-bit port address
;; $v: 8-bit value to write
(func $writePort (param $addr i32) (param $v i32)
  get_local $addr
  get_local $v
  (i32.add
    (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
    (i32.const 4)
  )
  call_indirect (type $PortWriteFunc)
)

;; Writes the specified TBBLUE index of the current machine type
;; $idx: 8-bit index register value
(func $writeTbBlueIndex (param $idx i32)
  (call $incTacts (i32.const 3))

  ;; Allow to write the log
  get_local $idx
  (i32.add
    (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
    (i32.const 5)
  )
  call_indirect (type $TbBlueWriteFunc)
)

;; Writes the specified TBBLUE value of the current machine type
;; $idx: 8-bit index register value
(func $writeTbBlueValue (param $idx i32)
  (call $incTacts (i32.const 3))

  get_local $idx
  (i32.add
    (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
    (i32.const 6)
  )
  call_indirect (type $TbBlueWriteFunc)
)

;; ==========================================================================
;; Execution cycle methods

;; Executes the CPU's processing cycle
(func $executeCpuCycle
  ;; Is there any CPU signal raised?
  (i32.ne (get_global $stateFlags) (i32.const 0))
  if
    ;; Yes, process them
    (i32.ne (call $processCpuSignals) (i32.const 0))
    if return end
  end

  ;; It's time to process the next op code
  ;; Read it from PC and store in opCode
  call $readCodeMemory
  set_global $opCode

  ;; Execute a memory refresh
  call $refreshMemory

  ;; Clear helper debug information
  i32.const 0 set_global $retExecuted

  ;; Test for no prefix
  (i32.eq (get_global $prefixMode) (i32.const 0))
  if
    ;; Execute the current operation
    i32.const 0 set_global $isInterruptBlocked
    call $processStandardOrIndexedOperations
    (i32.eq (get_global $isInterruptBlocked) (i32.const 0))
    if
      i32.const 0 set_global $indexMode
      i32.const 0 set_global $prefixMode
      i32.const 0 set_global $isInOpExecution
    end
    return
  end

  ;; Branch according to prefix modes
  ;; Test for extended mode
  (i32.eq (get_global $prefixMode) (i32.const 1))
  if
    i32.const 0 set_global $isInterruptBlocked
    call $processExtendedOperations
    i32.const 0 set_global $indexMode
    i32.const 0 set_global $prefixMode
    i32.const 0 set_global $isInOpExecution
    return
  end

  ;; Branch according to prefix modes
  ;; Test for bit mode
  (i32.eq (get_global $prefixMode) (i32.const 2))
  if
    i32.const 0 set_global $isInterruptBlocked
    call $processBitOperations
    i32.const 0 set_global $indexMode
    i32.const 0 set_global $prefixMode
    i32.const 0 set_global $isInOpExecution
    return
  end
)

;; Process the CPU signals
;; Returns true, if the signal has been processed; otherwise, false
(func $processCpuSignals (result i32)
  ;; Test for INT
  (i32.and (get_global $stateFlags) (i32.const 0x01 (; INT signal ;)))
  if
    ;; Test for unblocked interrupt
    (i32.eq (get_global $isInterruptBlocked) (i32.const 0))
    if
      (i32.ne (get_global $iff1) (i32.const 0))
      if
        call $executeInterrupt
        i32.const 1
        return
      end
    end
  end

  ;; Test for NMI
  (i32.and (get_global $stateFlags) (i32.const 0x02 (; NMI signal ;)))
  if
    call $executeNMI
    i32.const 1
    return
  end

  ;; Test for HLT
  (i32.and (get_global $stateFlags) (i32.const 0x08 (; HLT signal ;)))
  if
    (call $incTacts (i32.const 3))
    call $refreshMemory
    i32.const 1
    return
  end

  ;; Test for RST
  (i32.and (get_global $stateFlags) (i32.const 0x04 (; RST signal ;)))
  if
    call $resetCpu
    i32.const 1
    return
  end

  ;; No active signals to process
  i32.const 0
)

;; Refreshes the memory
(func $refreshMemory
  (local $r i32)
  ;; r := (r + 1) & 0x7f | (r & 0x80)
  call $getR
  tee_local $r
  i32.const 1
  i32.add
  i32.const 0x7f
  i32.and
  get_local $r
  i32.const 0x80
  i32.and
  i32.or
  call $setR
  (call $incTacts (i32.const 1))
)

;; Resets the CPU
(func $resetCpu
  i32.const 0 set_global $iff1
  i32.const 0 set_global $iff2
  i32.const 0 set_global $interruptMode
  i32.const 0 set_global $isInterruptBlocked
  i32.const 0 set_global $stateFlags
  i32.const 0 set_global $prefixMode
  i32.const 0 set_global $indexMode
  (call $setPC (i32.const 0))
  (call $setI (i32.const 0))
  (call $setR (i32.const 0))
  i32.const 0x0000 set_global $isInOpExecution
  i32.const 0x0000 set_global $tacts
)

;; Executes the NMI request
(func $executeNMI
    ;; Test for HLT
  (i32.and (get_global $stateFlags) (i32.const 0x08 (; HLT signal ;) ))
  if
    (set_global $PC 
      (i32.and (i32.add (get_global $PC) (i32.const 1)) (i32.const 0xffff)) 
    )
    (i32.and (get_global $stateFlags) (i32.const 0xf7 (; ~HLT mask ;) ))
    set_global $stateFlags
  end
  get_global $iff1 set_global $iff2
  i32.const 0 set_global $iff1

  ;; Push PC
  get_global $PC
  call $pushValue

  ;; Set NMI routione address
  (call $setPC (i32.const 0x0066))
)

;; Executes the NMI request
(func $executeInterrupt
  (local $addr i32)
  (local $oldPc i32)

  ;; Save the PC
  get_global $PC set_local $oldPc

  ;; Test for HLT
  (i32.and (get_global $stateFlags) (i32.const 0x08 (; HLT signal ;) ))
  if
    (set_global $PC 
      (i32.and (i32.add (get_global $PC) (i32.const 1)) (i32.const 0xffff)) 
    )
    (i32.and (get_global $stateFlags) (i32.const 0xf7 (; ~HLT mask ;) ))
    set_global $stateFlags
  end

  i32.const 0 set_global $iff1
  i32.const 0 set_global $iff2
  
  ;; Push PC
  get_global $PC
  call $pushValue
  
  ;; Test interrupt mode 0
  (i32.eq (get_global $interruptMode) (i32.const 2))
  if
    ;; Interrupt mode 2
    (call $incTacts (i32.const 2))
    
    ;; Let's assume, the device retrieves 0xff (the least significant bit is ignored)
    ;; addr = i << 8 | 0xfe;
    call $getI
    i32.const 8
    i32.shl
    i32.const 0xfe
    i32.or
    tee_local $addr
    (call $incTacts (i32.const 5))
    call $readMemory
    (i32.add (get_local $addr) (i32.const 1))
    call $readMemory
    i32.const 8
    i32.shl
    i32.or
    call $setWZ
    (call $incTacts (i32.const 6))
  else
    ;; Interrupt mode 0 or 1
    (call $setWZ (i32.const 0x0038))
    (call $incTacts (i32.const 5))
  end

  ;; pc := wz
  call $getWZ
  call $setPC

  ;; Support step-over debugging
  (call $pushToStepOver (get_local $oldPc))  
)

;; Processes standard or indexed operations
(func $processStandardOrIndexedOperations
  ;; Diagnostics
  get_global $INDEXED_JT
  get_global $STANDARD_JT
  get_global $indexMode
  select
  get_global $opCode
  i32.add
  call_indirect (type $OpFunc)
)

;; Processes bit operations
(func $processBitOperations
  get_global $indexMode
  if
    ;; indexed bit operations
    ;; WZ := IX + opCode
    call $getIndexReg
    get_global $opCode
    i32.const 24
    i32.shl
    i32.const 24
    i32.shr_s
    i32.add
    call $setWZ

    ;; Adjust tacts
    (i32.eq (get_global $useGateArrayContention) (i32.const 0))
    if
      get_global $PC
      call $memoryDelay
    end
    (call $incTacts (i32.const 1))
    call $getWZ ;; The address to use with the indexed bit operation

    ;; Get operation function
    get_global $INDEXED_BIT_JT
    call $readCodeMemory
    set_global $opCode
    get_global $opCode
    i32.add
    call_indirect (type $IndexedBitFunc)
  else
    ;; Normal bit operations
    (i32.add (get_global $BIT_JT) (get_global $opCode))
    call_indirect (type $OpFunc)
  end
)

;; Processes extended operations
(func $processExtendedOperations
  get_global $EXTENDED_JT
  get_global $opCode
  i32.add
  call_indirect (type $OpFunc)
)

;; ==========================================================================
;; Instruction helpers

;; Decrements the value of SP
(func $decSP
  (set_global $SP 
    (i32.and (i32.sub (get_global $SP) (i32.const 1)) (i32.const 0xffff)) 
  )
)

;; Pushes the value to the stack
(func $pushValue (param $v i32)
  (local $sp i32)
  call $decSP
  (call $incTacts (i32.const 1))
  get_global $SP
  (i32.shr_u (get_local $v) (i32.const 8))
  call $writeMemory
  call $decSP
  get_global $SP
  get_local $v
  call $writeMemory
)

;; Pops a value to the stack
(func $popValue (result i32)
  get_global $SP
  call $readMemory
  (set_global $SP 
    (i32.and (i32.add (get_global $SP) (i32.const 1)) (i32.const 0xffff)) 
  )
  get_global $SP
  call $readMemory
  (set_global $SP 
    (i32.and (i32.add (get_global $SP) (i32.const 1)) (i32.const 0xffff)) 
  )
  i32.const 8
  i32.shl
  i32.or
)

;; Reads the memory location at PC
(func $readCodeMemory (result i32)
  get_global $PC
  call $readMemory ;; we'll return this value
  (set_global $PC 
    (i32.and (i32.add (get_global $PC) (i32.const 1)) (i32.const 0xffff)) 
  )
)

;; Add two 16-bit values following the add hl,NN logic
(func $AluAddHL (param $regHL i32) (param $other i32) (result i32)
  (local $f i32)
  (local $res i32)

  ;; Keep S, Z, and PV from F
  call $getF
  i32.const 0xc4 ;; Mask for preserving S, Z, PV
  i32.and
  set_local $f

  ;; Calc the value of H flag
  (i32.add
    (i32.and (get_local $regHL) (i32.const 0x0fff))
    (i32.and (get_local $other) (i32.const 0x0fff))
  )
  i32.const 0x08
  i32.shr_u
  i32.const 0x10 ;; Mask for H flag
  i32.and        ;; Now, we have H flag on top

  ;; Combine H flag with others
  get_local $f
  i32.or
  set_local $f

  ;; Calculate result
  (i32.add (get_local $regHL) (get_local $other))
  tee_local $res

  ;; Test for C flag
  i32.const 0x1_0000
  i32.ge_u
  if
    ;; Set C
    (i32.or (get_local $f) (i32.const 0x01))
    set_local $f
  end

  ;; Calculate R3 and R5 flags
  (i32.shr_u (get_local $res) (i32.const 8))
  i32.const 0x28 ;; Mask for R3, R5
  i32.and

  ;; Combine them with F
  get_local $f
  i32.or
  (call $setF (i32.and (i32.const 0xff)))

  ;; Fetch the result
  get_local $res
)

;; Add two 16-bit values following the sbc hl,NN logic
(func $AluAdcHL (param $other i32)
  (local $res i32)
  (local $f i32)
  (local $signed i32)

  ;; Calculate result
  (i32.add (call $getHL) (get_local $other))
  tee_local $res
  (i32.and (call $getF) (i32.const 0x01))
  tee_local $f
  i32.add
  tee_local $res

  ;; Calculate Z
  i32.const 0xffff
  i32.and
  if (result i32)  ;; (Z)
    i32.const 0x00
  else
    i32.const 0x40
  end

  ;; Calculate H
  (i32.and (call $getHL) (i32.const 0x0fff))
  (i32.and (get_local $other) (i32.const 0x0fff))
  i32.add
  get_local $f
  i32.add
  i32.const 8
  i32.shr_u
  i32.const 0x10 ;; Mask for H
  i32.and ;; (Z, H)

  ;; Calculate C
  i32.const 0x01
  i32.const 0x00
  (i32.and (get_local $res) (i32.const 0x1_0000))
  select ;; (Z, H, C)

  ;; Calculate PV
  (i32.shr_s 
    (i32.shl (call $getHL) (i32.const 16))
    (i32.const 16)
  )
  (i32.shr_s 
    (i32.shl (get_local $other) (i32.const 16))
    (i32.const 16)
  )
  i32.add
  get_local $f
  i32.add
  tee_local $signed
  i32.const -0x8000
  i32.lt_s
  get_local $signed
  i32.const 0x8000
  i32.ge_s
  i32.or
  if (result i32) ;; (Z, H, C, PV)
    i32.const 0x04
  else
    i32.const 0x00
  end

  ;; Store the result
  get_local $res
  call $setHL

  ;; Calculate S, R5, R3
  call $getH
  i32.const 0xA8 ;; Mask for S|R5|R3
  i32.and

  ;; Merge flags
  i32.or
  i32.or
  i32.or
  i32.or
  (call $setF (i32.and (i32.const 0xff)))
)

;; Subtract two 16-bit values following the sbc hl,NN logic
(func $AluSbcHL (param $other i32)
  (local $res i32)
  (local $f i32)
  (local $signed i32)

  ;; Calculate result
  (i32.sub (call $getHL) (get_local $other))
  tee_local $res
  (i32.and (call $getF) (i32.const 0x01))
  tee_local $f
  i32.sub
  tee_local $res

  ;; Calculate Z
  i32.const 0xffff
  i32.and
  if (result i32)  ;; (Z)
    i32.const 0x00
  else
    i32.const 0x40
  end

  ;; Set N
  i32.const 0x02 ;; (Z, N)

  ;; Calculate H
  (i32.and (call $getHL) (i32.const 0x0fff))
  (i32.and (get_local $other) (i32.const 0x0fff))
  i32.sub
  get_local $f
  i32.sub
  i32.const 8
  i32.shr_u
  i32.const 0x10 ;; Mask for H
  i32.and ;; (Z, N, H)

  ;; Calculate C
  i32.const 0x01
  i32.const 0x00
  (i32.and (get_local $res) (i32.const 0x1_0000))
  select ;; (Z, N, H, C)

  ;; Calculate PV
  (i32.shr_s 
    (i32.shl (call $getHL) (i32.const 16))
    (i32.const 16)
  )
  (i32.shr_s 
    (i32.shl (get_local $other) (i32.const 16))
    (i32.const 16)
  )
  i32.sub
  get_local $f
  i32.sub
  tee_local $signed
  i32.const -0x8000
  i32.lt_s
  get_local $signed
  i32.const 0x8000
  i32.ge_s
  i32.or
  if (result i32) ;; (Z, N, H, C, PV)
    i32.const 0x04
  else
    i32.const 0x00
  end

  ;; Store the result
  get_local $res
  call $setHL

  ;; Calculate S, R5, R3
  call $getH
  i32.const 0xA8 ;; Mask for S|R5|R3
  i32.and

  ;; Merge flags
  i32.or
  i32.or
  i32.or
  i32.or
  i32.or
  (call $setF (i32.and (i32.const 0xff)))
)

;; Carries out a relative jump
;; $e: 8-bit distance value
(func $relativeJump (param $e i32)
  call $AdjustPcTact5

  ;; Convert the 8-bit distance to i32
  (i32.shr_s 
    (i32.shl (get_local $e) (i32.const 24))
    (i32.const 24)
  )

  ;; Calculate the destination address
  get_global $PC
  i32.add
  call $setPC

  ;; Copy to WZ
  get_global $PC
  call $setWZ
)

;; Adjust tacts for IX-indirect addressing
(func $AdjustPcTact5
  get_global $PC
  call $Adjust5Tacts
)

;; Adjust tacts for IX-indirect addressing
(func $Adjust5Tacts (param $addr i32)
  ;; Adjust tacts
  get_global $useGateArrayContention
  if
    (call $incTacts (i32.const 5))
  else
    (call $memoryDelay (get_local $addr))
    (call $incTacts (i32.const 1))
    (call $memoryDelay (get_local $addr))
    (call $incTacts (i32.const 1))
    (call $memoryDelay (get_local $addr))
    (call $incTacts (i32.const 1))
    (call $memoryDelay (get_local $addr))
    (call $incTacts (i32.const 1))
    (call $memoryDelay (get_local $addr))
    (call $incTacts (i32.const 1))
  end
)

;; Gets the index address for an operation
(func $getIndexedAddress (result i32)
  call $getIndexReg
  (i32.shr_s 
    (i32.shl (call $readCodeMemory) (i32.const 24))
    (i32.const 24)
  )
  i32.add
)

;; Executes ALU addition; sets A and F
;; $arg: other argument
;; $c: Value of the C flag
(func $AluAdd (param $arg i32) (param $c i32)
  (local $a i32)
  (local $res i32)
  (local $pv i32)
  ;; Add values (+carry) and store in A
  call $getA
  tee_local $a
  get_local $arg
  i32.add
  get_local $c
  i32.add
  tee_local $res
  (call $setA (i32.and (i32.const 0xff)))

  ;; Put Z on stack
  i32.const 0x00 ;; NZ
  i32.const 0x40 ;; Z
  (i32.and (get_local $res) (i32.const 0xff))
  select         ;; Z

  ;; Get S, R5, and R3 from result
  get_local $res
  i32.const 0xa8
  i32.and        ;; Z, S|R5|R3

  ;; Get C flag
  get_local $res
  i32.const 0x100
  i32.and
  i32.const 8
  i32.shr_u      ;; Z, S|R5|R3, C

  ;; Calculate H flag
  i32.const 0x10
  i32.const 0x00
  (i32.and (get_local $a) (i32.const 0x0f))
  (i32.and (get_local $arg) (i32.const 0x0f))
  i32.add
  get_local $c
  (i32.and (i32.add) (i32.const 0x10))
  select        ;; Z, S|R5|R3, C, H

  ;; <i32>$arg + <i32>$a + C
  (i32.shr_s 
    (i32.shl (get_local $a) (i32.const 24))
    (i32.const 24)
  )
  tee_local $pv
  (i32.shr_s 
    (i32.shl (get_local $arg) (i32.const 24))
    (i32.const 24)
  )
  i32.add
  get_local $c
  i32.add
  tee_local $pv

  ;; Calculate PV flag
  i32.const 0x80
  i32.ge_s
  if (result i32)
    i32.const 0x04
  else
    get_local $pv
    i32.const -0x81
    i32.le_s
    if (result i32)
      i32.const 0x04
    else
      i32.const 0x00
    end
  end

  ;; Merge flags
  i32.or
  i32.or
  i32.or
  i32.or
  (call $setF (i32.and (i32.const 0xff)))
)

;; Executes ALU subtraction; sets A and F
;; $arg: other argument
;; $c: Value of the C flag
(func $AluSub (param $arg i32) (param $c i32)
  (local $a i32)
  (local $res i32)
  (local $pv i32)
  ;; Subtract values (-carry) and store in A
  call $getA
  tee_local $a
  get_local $arg
  i32.sub
  get_local $c
  i32.sub
  tee_local $res
  (call $setA (i32.and (i32.const 0xff)))

  ;; Put Z on stack
  i32.const 0x00 ;; NZ
  i32.const 0x40 ;; Z
  (i32.and (get_local $res) (i32.const 0xff))
  select         ;; Z

  ;; Get S, R5, and R3 from result
  get_local $res
  i32.const 0xa8
  i32.and        ;; Z, S|R5|R3

  ;; Get C flag
  get_local $res
  i32.const 0x100
  i32.and
  i32.const 8
  i32.shr_u      ;; Z, S|R5|R3, C

  ;; Calculate H flag
  i32.const 0x10
  i32.const 0x00
  (i32.and (get_local $a) (i32.const 0x0f))
  (i32.and (get_local $arg) (i32.const 0x0f))
  i32.sub
  get_local $c
  i32.sub
  i32.const 0x10
  i32.and
  select        ;; Z, S|R5|R3, C, H

  ;; <i32>$a - <i32>$arg - C
  (i32.shr_s 
    (i32.shl (get_local $a) (i32.const 24))
    (i32.const 24)
  )
  tee_local $pv
  (i32.shr_s 
    (i32.shl (get_local $arg) (i32.const 24))
    (i32.const 24)
  )
  i32.sub
  get_local $c
  i32.sub
  tee_local $pv

  ;; Calculate PV flag
  i32.const 0x80
  i32.ge_s
  if (result i32)
    i32.const 0x04
  else
    get_local $pv
    i32.const -0x81
    i32.le_s
    if (result i32)
      i32.const 0x04
    else
      i32.const 0x00
    end
  end

  ;; Merge flags
  i32.or
  i32.or
  i32.or
  i32.or

  ;; Set N
  i32.const 0x02 ;; N flag mask
  i32.or
  (call $setF (i32.and (i32.const 0xff)))
)

;; Executes ALU AND operations; sets A and F
;; $arg: other argument
(func $AluAnd (param $arg i32)
  (i32.and (call $getA) (get_local $arg))
  (call $setA (i32.and (i32.const 0xff)))

  ;; Adjust flags
  (i32.add (get_global $LOG_FLAGS) (call $getA))
  i32.load8_u

  ;; Set H
  i32.const 0x10 ;; H flag mask
  i32.or
  (call $setF (i32.and (i32.const 0xff)))
)

;; Executes ALU XOR operation; sets A and F
;; $arg: other argument
(func $AluXor (param $arg i32)
  (i32.xor (call $getA) (get_local $arg))
  (call $setA (i32.and (i32.const 0xff)))

  ;; Adjust flags
  (i32.add (get_global $LOG_FLAGS) (call $getA))
  i32.load8_u
  (call $setF (i32.and (i32.const 0xff)))
)

;; Executes ALU OOR operation; sets A and F
;; $arg: other argument
(func $AluOr (param $arg i32)
  (i32.or (call $getA) (get_local $arg))
  (call $setA (i32.and (i32.const 0xff)))

  ;; Adjust flags
  (i32.add (get_global $LOG_FLAGS) (call $getA))
  i32.load8_u
  (call $setF (i32.and (i32.const 0xff)))
)

;; Executes ALU 8-add compare; sets F
;; $arg: other argument
(func $AluCp (param $arg i32)
  (local $res i32)
  (local $signed i32)

  ;; Subtract values
  call $getA
  get_local $arg
  i32.sub
  set_local $res
  
  ;; Signed substract
  (i32.shl (call $getA) (i32.const 24))
  (i32.shr_s (i32.const 24))
  (i32.shl (get_local $arg) (i32.const 24))
  (i32.shr_s (i32.const 24))
  i32.sub
  set_local $signed

  ;; Calculate N flag (set)
  i32.const 0x02 ;; [N]

  ;; Calculate H flag
  (i32.and (call $getA) (i32.const 0x0f))
  (i32.and (get_local $arg) (i32.const 0x0f))
  i32.sub
  (i32.and (i32.const 0x10)) ;; [N, H] 

  ;; Keep S, R3, and R5 from result
  (i32.and (get_local $res) (i32.const 0xa8)) ;; [N, H, S|R3|R5]

  ;; Calculate Z flag
  i32.const 0x00
  i32.const 0x40
  (i32.and (get_local $res) (i32.const 0xff))
  select ;; [N, H, S|R3|R5, Z]

  ;; Calculate C
  i32.const 0x01
  i32.const 0x00
  (i32.and (get_local $res) (i32.const 0x10000))
  select ;; [N, H, S|R3|R5, Z, C]

  ;; Calculate PV
  (i32.ge_s (get_local $signed) (i32.const 0x80))
  if (result i32)
    i32.const 0x04
  else
    (i32.le_s (get_local $signed) (i32.const -0x81))
    if (result i32)
      i32.const 0x04
    else
      i32.const 0x00
    end
  end

  ;; Merge flags and store them
  i32.or
  i32.or
  i32.or
  i32.or
  i32.or
  (call $setF (i32.and (i32.const 0xff)))
)

;; Tests the Z condition
(func $testZ (result i32)
  (i32.ne 
    (i32.and (call $getF) (i32.const 0x40))
    (i32.const 0)
  )
)

;; Tests the NZ condition
(func $testNZ (result i32)
  (i32.eq
    (i32.and (call $getF) (i32.const 0x40))
    (i32.const 0)
  )
)

;; Tests the C condition
(func $testC (result i32)
  (i32.ne
    (i32.and (call $getF) (i32.const 0x01))
    (i32.const 0)
  )
)

;; Tests the NC condition
(func $testNC (result i32)
  (i32.eq
    (i32.and (call $getF) (i32.const 0x01))
    (i32.const 0)
  )
)

;; Tests the PE condition
(func $testPE (result i32)
  (i32.ne
    (i32.and (call $getF) (i32.const 0x04))
    (i32.const 0)
  )
)

;; Tests the PO condition
(func $testPO (result i32)
  (i32.eq
    (i32.and (call $getF) (i32.const 0x04))
    (i32.const 0)
  )
)

;; Tests the M condition
(func $testM (result i32)
  (i32.ne
    (i32.and (call $getF) (i32.const 0x80))
    (i32.const 0)
  )
)

;; Tests the P condition
(func $testP (result i32)
  (i32.eq
    (i32.and (call $getF) (i32.const 0x80))
    (i32.const 0)
  )
)

;; Read address to WZ
(func $readAddrToWZ
  call $readCodeMemory
  call $readCodeMemory
  i32.const 8
  i32.shl
  i32.or
  call $setWZ
)

;; Read address from code
(func $readAddrFromCode (result i32)
  call $readCodeMemory
  call $readCodeMemory
  i32.const 8
  i32.shl
  i32.or
)

;; ============================================================================
;; Stack helper functions for step-over debugging

(global $stepOutStackDepth (mut i32) (i32.const 0x0000))
(global $retExecuted (mut i32) (i32.const 0x0000))
(global $stepOutAddress (mut i32) (i32.const 0x0000))
(global $stepOutStartDepth (mut i32) (i32.const 0x0000))

;; Resets the step-over stack
(func $resetStepOverStack
  i32.const 0 set_global $stepOutStackDepth
  i32.const 0 set_global $retExecuted
  i32.const -1 set_global $stepOutAddress
  i32.const 0 set_global $stepOutStartDepth
)

;; Marks the depth of the step-over stack before each run
(func $markStepOverStack
  get_global $stepOutStackDepth
  set_global $stepOutStartDepth
)

;; Pushes the value to the step-over stack
(func $pushToStepOver (param $value i32)
  ;; Do not allow stack overflow
  (i32.ge_u (get_global $stepOutStackDepth) (i32.const 512))
  if return end

  ;; Store the value on stack
  (i32.store16
    (i32.add 
      (get_global $STEP_OUT_STACK) 
      (i32.mul (i32.const 2) (get_global $stepOutStackDepth))
    )
    (get_local $value)
  )

  ;; Increment counter
  (i32.add (get_global $stepOutStackDepth) (i32.const 1))
  set_global $stepOutStackDepth
)

;; Pops a value from the step-over stack
(func $popFromStepOver
  ;; Do not allow stack underflow
  (i32.eqz (get_global $stepOutStackDepth))
  if
    i32.const 0
    return
  end

  ;; Decrement counter
  (i32.sub (get_global $stepOutStackDepth) (i32.const 1))
  set_global $stepOutStackDepth

  ;; Load the value from the stack
  (i32.load16_u
    (i32.add 
      (get_global $STEP_OUT_STACK) 
      (i32.mul (i32.const 2) (get_global $stepOutStackDepth))
    )
  )

  ;; Store as the step out address
  set_global $stepOutAddress

  ;; Sign a RET statement
  i32.const 1 set_global $retExecuted
)

;; ============================================================================
;; Memory write functions to help memory view refresh

;; Erases all breakpoints
(func $eraseMemoryWriteMap
  (local $counter i32)
  (local $addr i32)
  i32.const 0x2000 set_local $counter
  get_global $MEMWRITE_MAP set_local $addr
  loop $eraseLoop
    get_local $counter
    if
      (i32.store8 (get_local $addr) (i32.const 0))
      (i32.add (get_local $addr) (i32.const 1))
      set_local $addr
      (i32.sub (get_local $counter) (i32.const 1))
      set_local $counter
      br $eraseLoop
    end
  end
)

;; Sets the specified memory write point
(func $setMemoryWritePoint (param $point i32)
  (local $addr i32)
  get_global $MEMWRITE_MAP
  (i32.shr_u (get_local $point) (i32.const 3))
  i32.add
  tee_local $addr
  get_local $addr
  i32.load8_u ;; [ addr, point byte ]

  (i32.shl
    (i32.const 0x01)
    (i32.and (get_local $point) (i32.const 0x07))
  ) ;; Mask to set
  i32.or ;; [ addr, new point]
  i32.store8
)