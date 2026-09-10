---
title: "The Workflow I Used to Find Bugs in Windows, VirtualBox, and Linux"
date: 2026-09-10
description: "A step-by-step breakdown of the workflow I used to find bugs in Windows, VirtualBox, and the Linux kernel."
---

After spending a decent amount of time learning about security and doing CTFs, I decided to build my own workflow for vulnerability research. It's still far from finished, and I'm constantly testing, changing, and improving it, but I think it's a solid foundation already. Using this workflow, I've found several real-world vulnerabilities in major software (details will follow in separate posts once disclosure is complete).

The workflow is primarily designed for humans. The goal isn't to automate everything, but to provide a structured process for how to approach a target and decide what to investigate next. Automation can be added wherever it actually provides value. I know that not everyone likes using LLMs for security research, and I understand why, but you can't ignore it, because LLMs are extremely good at it.

## Overview

```
Stage 1:   Repo Analysis
Stage 1b:  Reverse Engineering (closed-source targets)
Stage 2:   Knowledge Graph
Stage 3:   Call Graph + Data Flow
Stage 4:   Risk Ranking
Stage 5:   Security Review
Stage 6:   Hypothesis Generation
Stage 7:   Hypothesis Ranking
Stage 8:   Harness Building
Stage 9:   Seed Generation
Stage 10:  Fuzzing
Stage 11:  Crash Collection
Stage 12:  Crash Deduplication
Stage 13:  Root Cause Analysis
Stage 14:  Exploit Strategy
Stage 15:  Reproduction (PoC)
Stage 16:  Build & Test Exploit
Stage 17:  Report
```

I'll walk through each stage, explain what it does, and show where automation makes sense.

---

## Stage 1: Repo Analysis

This is always the first thing I do before diving into any actual research. The goal is to build a solid mental model of the project: what it is, how it's built, and what it depends on.

- **What is the project?** What does it do, who is it for, and what's the scope? A hypervisor is a very different target than a PDF parser.
- **What programming languages are used?** This tells you what bug classes to expect. A C/C++ codebase has different vulnerability classes than a Java project.
- **Which libraries and dependencies are used?** Third-party code is attack surface too.

This stage is intentionally lightweight. It's not about finding bugs or reading code — it's about getting a decent overview of the target before going deeper.

## Stage 1b: Reverse Engineering (Optional)

If you have an open-source target, you can skip this stage. For closed-source targets, this step is essential.

In my workflow, I use a simple Python script that wraps Ghidra's headless analyzer (`GhidraAnalyzeHeadless`). It takes a binary, runs Ghidra's auto-analysis, and exports the decompiled output. The results are surprisingly usable, especially when debug symbols are present, which happens more often than you'd think, particularly on Windows targets that ship with PDB files.

The decompiled output isn't perfect, but it's good enough to feed into the later stages of the workflow (knowledge graph, call graph, risk ranking) without too much manual cleanup.

I'm currently pushing this stage further by finetuning a local LLM (Qwen 2.5 Coder 3B) specifically for decompilation cleanup. The goal is to take Ghidra's raw output and produce something closer to human-written C. That pipeline isn't finished yet, but even without it, Ghidra's output alone gives you enough to work with.

## Stage 2: Knowledge Graph

After Stage 1, you have a general understanding of the project. Now the goal is to bring some structure into all the code. A large codebase can have thousand of files and tens of thousands of functions, so you need some organization, otherwise you will get lost.

The knowledge graph connects everything that matters: functions, files, data flows, dependencies, and security-relevant relationships between them. Think of it as a structured map of the entire codebase. For example, if a file handles parsing of attacker-controlled input and passes results into memory management functions, that relationship gets captured in the graph.

I highly recommend automating this stage, especially for larger codebases. A human would need to focus for hours to build this overview, while an LLM can generate it in minutes.

## Stage 3: Call Graph and Data Flow

This stage takes it a step further by combining the information from Stage 1 and Stage 2 into a graph that visualizes two things: which function calls which function, and how data (especially user input) flows through the system.

The questions you should ask yourself during this stage:

- Where does user input enter the program?
- Which functions touch it along the way?
- Where does it end up?

Every answer points you toward attack surface. The core principle: wherever user input goes, that's where the biggest attack surface is. Functions that never touch external input are far less interesting than functions that sit directly in the path of attacker-controlled data.

As a concrete example: if you're analyzing a file parser, you want to trace how metadata fields from the file get read, where they're stored, and what operations they end up in. If attacker-controlled values flow into size calculations or memory allocations without proper validation, that's a high-priority finding.

## Stage 4: Risk Ranking

Once you have the call graph and data flow, you can start ranking. Not every function deserves the same amount of attention, and you need a way to decide where to look first.

The ranking is based on what you've already collected. Which functions handle attacker-controlled input, how deep that input travels into the system, and what it eventually gets used for. Functions that take untrusted data and pass it into sensitive operations (memory allocations, size calculations, index lookups) rank higher than functions that only deal with internal state.

This stage doesn't need to be perfect. You just create a small priority list.

## Stage 5: Security Review

This is where the actual bug hunting happens. Everything up to this point was preparation. Now you take that priority list and systematically work through it.

Pick a high-ranked function, follow the user input from where it enters, and trace it all the way down. Watch what happens to it at every step:

- Does it end up in a memory allocation or size calculation?
- Does it get used as an array index?
- Does it pass through any validation or sanitization?
- Does it get cast to a smaller type?

Every time attacker-controlled data touches one of these operations without proper checks, you're looking at a potential vulnerability. Integer overflows before allocations, unchecked sizes passed to `memcpy`, attacker-controlled indices into arrays, these are the patterns you're hunting for.

## Stage 6: Hypothesis Generation

At this point, you've done the deep review and you've spotted some things that look suspicious or maybe even areas. Now you turn those observations into concrete hypotheses.

For example: "If an attacker provides a large enough value in this metadata field, the multiplication in the size calculation will overflow the `uint32`, causing a near-zero allocation followed by a large loop that writes out of bounds."

A hypothesis isn't a vague feeling that something looks off. It's specific enough that you can build a test for it.

## Stage 7: Hypothesis Ranking

Same idea as Stage 4, but applied to your hypotheses instead of functions. Not every hypothesis is equally likely to lead to a real bug, so you rank them before investing time into building harnesses and fuzzing.

The ranking criteria are intuitive:

- How directly does attacker input influence the suspicious code path?
- How severe would the impact be if the hypothesis is correct? Is it a heap overflow or just a redundant check?
- How many validation layers does the data pass through before reaching the vulnerable operation?

A hypothesis involving attacker-controlled data flowing straight into a heap allocation with an integer overflow ranks above one where the data passes through several validation layers first.

This stage is quick and lightweight, but it keeps you from spending days fuzzing a low-probability hypothesis while a more promising one sits untouched.

## Stage 8: Harness Building

Hypotheses are all well and good, but they don't prove anything, you need to test them. The most effective way to do that, in my experience, is fuzzing with an address sanitizer (ASan). But before you can fuzz, you need a harness.

The harness is a small program that isolates the code path your hypothesis targets and exposes it to the fuzzer. You pick a hypothesis from your ranking, identify the function or code path it involves, and write a harness that feeds mutated input directly into that path. Remember though that your harness must be pretty precise, so the fuzzer can catch the vulnerable path fast. A harness that's too broad, is slow and unlikely to hit the vulnerable path I any reasonable time.

## Stage 9: Seed Generation

Before the fuzzer can start, it needs something to mutate. A seed is a valid input file that the fuzzer uses as a starting point and then mutates byte by byte to explore new code paths and edge cases.

The better your seeds, the faster the fuzzer reaches interesting code. A completely random file would waste most of its time just trying to pass basic format validation. A well-formed seed that already passes all the structural checks lets the fuzzer skip straight to the deeper logic, where the actual bugs tend to live.

If you're targeting a complex format, it helps to provide multiple seeds with different configurations so the fuzzer has a broader starting surface to work with.

## Stage 10: Fuzzing

Not much to say here tbh, you take your harness, your seeds, and you let the fuzzer run. If the previous stages were done well, this part is mostly waiting.

One thing I'd recommend is setting a time limit for each hypothesis. Fuzzing can run forever, and if a fuzzer hasn't found anything after a reasonable amount of time, it's usually better to move on to the next hypothesis rather than hoping for a miracle. You can always come back later with a refined harness or better seeds.

You can also run multiple hypotheses in parallel with different fuzzers. There's no reason to test them one at a time (if you have the hardware, use it). Different fuzzers (AFL++, libFuzzer, Honggfuzz) also have different mutation strategies, so running more than one against the same harness can catch things a single fuzzer might miss.

## Stage 11: Crash Collection

Once the fuzzer has been running for a while, you'll (hopefully) have a set of crashes. This stage is simply about collecting and organizing them. Most fuzzers already sort crashes into a dedicated output directory, but it's worth going through them early to get a rough sense of what you're dealing with. Also watch out, sometimes the fuzzer produces crashes, which are harness caused.

Don't start analyzing anything deeply yet. Just gather everything in one place so the next stage can work with a clean dataset.

## Stage 12: Crash Deduplication

Fuzzers tend to produce a lot of duplicate crashes. A single buffer overflow might trigger crashes at offsets 64, 65, 66, 67, and so on, same bug, different inputs. Before you spend time analyzing, you need to deduplicate.

The simplest approach is grouping crashes by their stack trace or crash address. Tools like AFL++'s `afl-cmin` or custom scripts can reduce thousands of crashes down to a handful of unique ones. The goal is to end up with one representative input per distinct bug, so you're not wasting time analyzing the same crash over and over.

## Stage 13: Root Cause Analysis

Now you take each unique crash and figure out what's actually happening. This is where you go from "it crashed" to "I understand why it crashed."

Look at the crash under a debugger, trace the input that caused it, and identify the root cause.The root cause determines whether this is just a DoS or something more serious.

Exploitability is the next question. A null pointer dereference is usually just a crash. A heap out-of-bounds write can lead to controlled heap corruption, which can lead to code execution. Tools like `!exploitable` on Windows or GDB plugins can give you a rough initial assessment, but the real answer comes from understanding the bug mechanics yourself.

## Stages 14-17: Exploit Strategy, PoC, testing and Reporting

These stages are where you take a confirmed bug and turn it into a full proof of concept, develop an exploit strategy, and write the report. I'll cover these in detail in future posts when I can walk through them with real examples after disclosure.

---

## Where LLMs Fit In

 I just want to be clear, that this workflow works without LLMs. You can do every single stage manually. But LLMs make several stages significantly faster:

- **Stage 1 & 2:** An LLM can analyze a repo structure and build a knowledge graph in minutes instead of hours.
- **Stage 3:** Data flow tracing across large codebases is tedious. LLMs handle this well.
- **Stage 5:** LLMs are surprisingly good at spotting suspicious patterns in code, especially common bug classes like integer overflows and unchecked sizes.
- **Stage 8 & 9:** Harness and seed generation can be partially automated.
- **Stage 13:** Root cause analysis from crash data is something LLMs can assist with.


---

## What's Next

This workflow is a living document. I'm constantly refining it based on what works and what doesn't. I'm currently working on:

- Finishing the finetuned Qwen 2.5 Coder 3B pipeline for Stage 1b
- Building better automation for Stages 2-4
- Writing up the vulnerabilities I've found using this workflow (coming after disclosure)

If you have questions or suggestions, reach out to me [here](https://x.com/gatekeeperr0), [here](https://www.threads.net/@gatekeeperr) or on discord: gatekeeperr0. I'm always looking to improve this process.
