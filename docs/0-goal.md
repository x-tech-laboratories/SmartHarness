# Goal

SmartHarness is a harness that lets small LLMs run on consumer computers punch far above their weight in capability, reasoning, memory and the ability to research and learn. It is an experiment in how far a 4B model can be pushed by the code around it.

**Why local and small:** large models need datacenters, which means subscriptions and sending private data away. Small models run on the user's own hardware but have stale knowledge and weak reasoning. The harness is there to close that gap.

**The method:** deterministic harness code externalizes thinking steps (gathering facts, researching, loading/storing/refining memory, review and critique) and runs each as an atomic, independent task. Each task re-prompts the model with a fresh context, dedicated memory, hyperspecific instructions and a scratchpad that carries forward only what later steps need. The combination of model and harness should show emergent reasoning and memory beyond what the model manages alone.

**Learn how to learn, not what to know:** the model's weights supply language and common sense; facts, how-to knowledge and skills live outside it, where they can be researched, checked, updated and corrected. A model taught to search, store and retrieve does not go out of date the day it ships.

**Measured, not assumed:** every change is judged by the evals in `evals/`, run against the same small reference model, so a gain is the harness's and not a bigger model's.

**The long-range aim:** a harness that re-prompts one core model for each function a mind needs (perceiving events, storing and recalling memory, prioritizing, reviewing the results of its own actions, setting and pursuing goals, drives, initiative, reflection), learning continuously in idle time.

**What it is not:** an application. It has no window, daemon, mail or persona; applications such as [CODEX](https://github.com/x-tech-laboratories/CODEX), a personal assistant, build on it and add those. Their real failures are a good source of new eval tasks.

**Nothing is settled.** The design in docs 1–2 records what is built and why, not a commitment. Any part of the strategy or architecture, including the model, the decomposition method and the memory design, may change when evals show something better.

## The docs

- `0-goal.md`: this file.
- `1-architecture.md`: what is built, how it works, and why.
- `2-open-questions-and-approaches.md`: the open questions, and the unbuilt approaches that answer them.
- `3-roadmap.md`: order, status, and how to measure each step.

An approach moves from doc 2 to doc 1, with its rationale, once it is built; one an eval rejects moves to `docs/done/` with the result.
