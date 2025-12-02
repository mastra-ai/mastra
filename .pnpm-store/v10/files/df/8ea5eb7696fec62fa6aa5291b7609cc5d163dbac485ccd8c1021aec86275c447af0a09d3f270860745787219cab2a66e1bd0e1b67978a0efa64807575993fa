	# References to local labels are rewrittenn in subsequent files.
.Llocal_label:
	jbe .Llocal_label
	leaq .Llocal_label+2048(%rip), %r14
	leaq .Llocal_label+2048+1024(%rip), %r14

	.section .rodata
.L1:
	.quad 42
.L2:
	.quad .L2-.L1
	.uleb128 .L2-.L1
	.sleb128 .L2-.L1

# .byte was not parsed as a symbol-containing directive on the
# assumption that it's too small to hold a pointer. But Clang
# will store offsets in it.
.byte   (.LBB231_40-.LBB231_19)>>2, 4, .Lfoo, (.Lfoo), .Lfoo<<400, (   .Lfoo ) <<  66
.byte   421
