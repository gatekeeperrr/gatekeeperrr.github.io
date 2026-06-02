---
title: "Binary Security Mechanisms: Stack Canary"
date: 2026-06-02
description: "A brief explanation of the stack canary and how to bypass it"
---

In the previous article we covered RELRO and ASLR + PIE, in this section, we'll focus on the **stack canary.** This is my third post in this short series of articles in which I explain the five most important binary security mechanisms. If you haven't read the other articles yet, you can do so [here](https://mlowlevl.xyz/blog/binary-security-mechanisms-pie-aslr/) and [here ](https://mlowlevl.xyz/blog/binary-security-mechanisms-relro/).

## Stack Canary

The stack canary is a random value that the compiler inserts between the local variables and the RBP, return address.

`local variables -> canary -> saved RBP -> return address.`

This effectively makes it an early warning system for buffer overflows. If an attacker tries to overwrite the return address, they will eventually encounter the stack canary, since it is located before the return address. Before the function terminates, the program checks whether the stack canary has been altered. If it has been altered, the program aborts immediately.This prevents the attacker from taking control of the program. When the program starts, the kernel generates a random 8-byte value via`/dev/urandom` (Linux) .  That means there are 2⁶⁴ possible stack canaries, but on Linux the lowest bytes are usually 0x00, which means there are 2⁵⁶ possible stack canaries, making it impossible to guess them.



## Stack Canary Bypass

There are two ways to bypass the stack canary security mechanism

#### Stack Canary Leaking:

If the attacker  can read memory, for example with a format string vulnerability the can leak the stack canary. Then the attacker can simply overwrite the stack canary with the correct value and the canary test doesn't detect anything

#### Non-Terminating Overflows:

Some buffer overflows are gaining control over the stack before the function returns. Since canaries are only checked before the `ret` instruction, overwriting nearby function points or `jmp_buf` structures can redirect execution without ever triggering the stack canary check.


#### Other Vulnerabilities

It's **IMPORTANT** to note that the stack canary only makes attacks slightly more difficult, it doesn't make them impossible. Furthermore, it only protects against stack buffer overflows. Other vulnerabilities like heap overflow or use-after-free exploits aren't effected by stack canaries.




Author: Pr1meM
