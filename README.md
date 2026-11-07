# Smash Court 3D

A browser-based 3D badminton game foundation. Phase 1 is a pure TypeScript rules engine with no rendering dependencies.

## Requirements

- Node.js 20+
- npm 10+

## Commands

```bash
npm install
npm test
npm run typecheck
npm run rules:demo
```

## Architecture

- `src/rules/types.ts`: typed match, service, and umpire decision domain.
- `src/rules/scoring.ts`: pure rally-scoring and service-court parity functions.
- `src/rules/service.ts`: service legality and court geometry.
- `src/rules/faults.ts`: BWF fault/let classification and service-court correction.
- `src/rules/match.ts`: explicit match state machine, toss, service order, intervals, and end changes.
- `src/cli.ts`: deterministic sample match transcript.

The rules package is independent of Three.js and can be reused by another game engine.

## Rules source and scope

Code comments cite the relevant law numbers from the BWF Laws of Badminton, Section 4.1, 2025 edition (effective 26 April 2025). The standard 1.15 m service-height law is used. Competition-specific alternative service laws and Para-badminton variations are not enabled in this initial implementation.

Official reference: https://system.bwfbadminton.com/documents/folder_1_81/Statutes/CHAPTER-4---RULES-OF-THE-GAME/SECTION%204.1-%20Laws%20of%20Badminton.pdf

## Phase 1 status

This is the initial rules-engine milestone. Run tests and review the documented known limitations before treating it as tournament-grade. Physics-derived calls, visual player positions, and a full rally simulator arrive in later phases.
