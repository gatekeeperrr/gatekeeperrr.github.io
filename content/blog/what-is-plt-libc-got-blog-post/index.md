---
title: "What is libc, GOT and PLT?"
date: 2026-03-29
description: "Explaining libc, GOT, and PLT and how attackers exploit them for ROP."
---

PLT, GOT and libc are three common concepts every C/C++ programmer works with, but not every programmer is familiar with it so I thought I’d do a small post explaining it. I also will give a simple example how Hackers use libc or the GOT to exploit programs with bad security.

**libc** is the standard c library used by almost every C/C++ program on Linux. Its a collection of predefined functions such as `printf` ,`puts` ,`malloc`or `fgets`. Thats insanly helpful , because you don’t have to implement low-level functionality yourself like string, memory and so on. 
When you compile a program, it gets linked against libc. There are two main types of linking. Firstly the **static linking** that means the required libc code is directly included inside the binary at compile time. This makes the binary larger but self contained.
The more common way today is the **dynamic linking**. Instead of copying libc into the binary, it is loaded at runtime and mapped into the process memory. This is handled by the dynamic loader ld.

But libc isnt only for predefined functions it also acts as a wrapper  that prepares syscalls. For example when you call `execve()` (quick explanation: execve() is a syscall which replaces the current process with a new one.) When a programmer writes execve() in his program the libc prepares the syscall by setting the CPU registers. After that libc executes the syscall instructions and the kernel takes over. In case of the `execve` the kernel replaces the current process with a new one.

**The GOT (Global Offset Table)** is a section inside the compiled binary. It contains pointers to external functions such as puts or printf from libc.Because of ASLR (Address Space Layout Randomization), libc is loaded at a different memory address each time the program starts. This means the binary does not know the real address of functions like puts beforehand.The GOT solves this problem by storing the real runtime addresses of external functions after they are resolved by the dynamic linker.

**PLT** or Procedure Linkage Table acts as a bridge between the program and the GOT.

The GOT itself is just data, not executable code, so the program cannot directly “call” the GOT. Instead, the binary calls a PLT entry first.

For every external function there is a PLT entry that looks roughly like this:
```asm
puts@PLT:
	jmp [puts@GOT]
```
The PLT entry simply jumps to the address stored inside the GOT entry for `puts`

So the flow looks like this:
`program -> PLT -> GOT -> libc function`


**In conclusion** 
- libc is the standard runtime library containing functions like `printf` and `puts`
- the GOT stores the real runtime addresses of external functions
- the PLT is used to jump to those addresses indirectly

For example, when a program calls `puts`, it usually does not directly know where `puts` is located in memory because of ASLR. Instead, the program calls `puts@plt`. The PLT then looks up the real address from the GOT and finally jumps into `puts` inside libc.



## Using GOT and libc for ROP?

As mentioned earlier, libc contains many useful functions. Two very interesting ones for exploit development are `system()` and `execve()`.

When exploit developers gain control over the stack, they often try to spawn a shell. If they can leak a libc address, they can calculate the base address of libc and therefore the location of functions like `system()`.

A very common technique is calling:
```c
system("/bin/sh")
```
This works because the string `"/bin/sh` also exists inside libs. By controlling the instruction pointer and setting up the correct arguments, attackers can redirect execution into libc and spawn a shell.

---
Author: ml0w6c65766c
