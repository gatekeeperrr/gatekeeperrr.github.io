---
title: "Control Hijack - pwn.college (pwn, Hard)"
date: 2026-05-10
description: "pwn.college hard challenge — stack-based buffer overflow and control flow hijacking."
---

## Task

Overflow a buffer and smash the stack to obtain the flag!


## Approach

Unfortunately I can’t show the exact exploit details due to pwn.college rules, but I still want to share my general approach and thoughts.

My first step was running the program to understand its behavior. I noticed that the input was not properly limited, which indicated a potential buffer overflow vulnerability.

After that, I opened the binary in GDB to analyze what was happening internally. I disassembled the relevant parts of the program and looked for the stack layout. This helped me locate the input buffer in the assembly code.

I also searched for useful functions such as a `win` function using GDB to understand where I should redirect execution.


## Vulnerability

The issue was a classic stack-based buffer overflow:

- Input is read without proper bounds checking
- The buffer is located on the stack
- The return address can be overwritten

This makes it possible to control the execution flow by overwriting the return address.


## Exploitation Idea

The general idea was:

- Determine the offset from the buffer to the return address
- Overwrite the return address with the address of the win function
- Redirect execution flow to trigger the flag output

Example Payload written in C:


```
#include <string.h>
#include <unistd.h>
#include <stdint.h>

int main() {
    char payload[X];

    // overflow buffer up to return address
    memset(payload, 'A', X);

    // win_adresse
    uint64_t win_addr = X;

    // write the win_address directly starting at this offset
    memcpy(payload + X, &win_addr, 8);

    // send everything
    write(1, payload, X);

    return 0;
}

```


## Result

After applying the concept and running the exploit, the program execution was successfully redirected and the flag was obtained.

`pwn.college{REDACTED}`

---
Author: ml0w6c65766c
