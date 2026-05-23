---
title: "Binary Security Mechanisms: PIE + ASLR"
date: 2026-05-18
description: "A breakdown of PIE + ASLR, what they do, how they're connected, and how to bypass them."
---

In the previous article we covered RELRO. This time we'll look at two mechanisms that are closely related: PIE and ASLR. If you haven't read the RELRO article before you can find it here: 
[RELRO Article](https://mlowlevl.xyz/blog/binary-security-mechanisms-relro/) .
As mentioned in my last post, I’m starting a series of articles on my blog about binary security mechanisms and how to bypass them.

I will cover each of them in separate articles, this one focuses on **PIE & ASLR**.


## PIE

PIE is short for Position Independent Executable and it's a security mechanism for compiled ELF Binaries. Normally, the binary is always loaded to the same base address. This means the attacker knows exactly where each function is located. For example, if the binary is loaded at address 0x400000, then `main()` is located at address 0x41234. This means the attacker can hardcode this address into their exploit, since the binary and thus `main()` function is always loaded at the same spot.


## ASLR

ASLR stands for Address Space Layout Randomization and is a feature of the operating system. What ASLR does is move the stack, heap, and libraries. This applies to every process, regardless of whether PIE is enabled or not.


## Why PIE and ASLR together?

PIE and ASLR go hand in hand, as protection is only complete when used together. With PIE alone, the binary is capable of being loaded at a random base address, but without ASLR the OS will not actually randomize it. With ASLR alone, only the stack, heap and libraries are randomized, but the binary itself remains at a fixed address. Only together do they provide complete randomization.



## PIE + ASLR Bypass

**Bypass Binary (PIE):** To bypass PIE, you usually want to find the base address of the binary. To do this, you simply try to trigger a memory leak, for example through a format string vulnerability (%p).
Once you have this leak, you look up the offset in a tool like Ghidra. Then you can simply subtract the offset from the leak to determine the base address. From there, you can calculate everything else based on the base address.

**libc (ASLR) Bypass:** To bypass ASLR, you need either a libc leak or a GOT leak. In every version of libc, each function has a fixed offset relative to the libc base address. For example:

- `printf()` is always located at libc_base + 0x60000
- `system` is always located at libc_base + 0x50000

These offsets vary from one libc version to another, but remain constant within a given version. You can view them in GDB or look them up in a libc database such as libc.rip.

Here's what the process might look like:
1. You leak the GOT address of, for example, `printf` = `0x7f4a3b061234`
2. You know that the offset of `printf` in this libc version is `0x60000`
3. Therefore: `libc_base = 0x7f4a3b061234 - 0x60000 = 0x7f4a3b001234`
4. `system` has an offset of `0x50000` ->  `system = libc_base + 0x50000 = 0x7f4a3b051234`

**RBP/Stack (ASLR) Bypass:** Another example is the RBP leak. The RBP is often on the stack, so it can be leaked using a format string bug, for example. Once you have the RBP leak, you can calculate everything relative to the RBP.
Here is an simplified example(no real addresses):
- RBP leak = `0x54650`
- return adress offset relative to the RBP = `0x05350`
- Return Adress location = RBP + return adress offset 
- `0x54650 + 0x05350 = 0x56000`

Author: pr1meM
