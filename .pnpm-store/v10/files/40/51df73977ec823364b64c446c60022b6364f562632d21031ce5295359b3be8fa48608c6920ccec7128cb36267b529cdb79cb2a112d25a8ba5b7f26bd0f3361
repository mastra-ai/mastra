	.type foo, %function
	.globl foo
foo:
	// GOT load
	adrp x1, :got:stderr
	ldr x0, [x1, :got_lo12:stderr]

	// GOT load to x0
	adrp x0, :got:stderr
	ldr x1, [x0, :got_lo12:stderr]

	// GOT load with no register move
	adrp x0, :got:stderr
	ldr x0, [x0, :got_lo12:stderr]

	// Address load
	adrp x0, .Llocal_data
	add x1, x0, :lo12:.Llocal_data

	// Address of local symbol with offset
	adrp x10, .Llocal_data2+16
	add x11, x10, :lo12:.Llocal_data2+16

	// Address load with no-op add instruction
	adrp x0, .Llocal_data
	add x0, x0, :lo12:.Llocal_data

	// armcap
	adrp x1, OPENSSL_armcap_P
	ldr w2, [x1, :lo12:OPENSSL_armcap_P]

	// armcap to w0
	adrp x0, OPENSSL_armcap_P
	ldr w1, [x1, :lo12:OPENSSL_armcap_P]

	// Load from local symbol
	adrp x10, .Llocal_data2
	ldr q0, [x10, :lo12:.Llocal_data2]

	bl local_function

	bl remote_function

	bl bss_symbol_bss_get

	// Regression test for a two-digit index.
	ld1 { v1.b }[10], [x9]

	// Ensure that registers aren't interpreted as symbols.
	add x0, x0
	add x12, x12
	add w0, x0
	add w12, x12
	add d0, d0
	add d12, d12
	add q0, q0
	add q12, q12
	add s0, s0
	add s12, s12
	add h0, h0
	add h12, h12
	add b0, b0
	add b12, b12

	// But 'y' is not a register prefix so far, so these should be
	// processed as symbols.
	add y0, y0
	add y12, y12

	// Make sure that the magic extension constants are recognised rather
	// than being interpreted as symbols.
	add w0, w1, b2, uxtb
	add w0, w1, b2, uxth
	add w0, w1, b2, uxtw
	add w0, w1, b2, uxtx
	add w0, w1, b2, sxtb
	add w0, w1, b2, sxth
	add w0, w1, b2, sxtw
	add w0, w1, b2, sxtx


local_function:

// BSS data
.type bss_symbol,@object
.section .bss.bss_symbol,"aw",@nobits
bss_symbol:
.word 0
.size bss_symbol, 4
