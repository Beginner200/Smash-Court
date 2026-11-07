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


## Phase 2 — 3D court and physics sandbox

The browser sandbox uses Three.js, Vite, and a custom deterministic shuttle integrator.

### Run the 3D sandbox

```bash
npm install
npm run dev
```

Open the local Vite URL printed by the command. Use drag to orbit the court, scroll to zoom, and **Launch shuttle** to visualize a simulated flight. Choose singles or doubles to apply the relevant court width.

### Physics model

- Quadratic aerodynamic drag: `F_d = 0.5 × rho × CdA × |v|²`.
- Gravity with a fixed 1/240-second integration step.
- Deterministic fixed-step integration (no random forces).
- Net-plane and ground contact checks.
- Landing decisions are delegated to `src/rules/service.ts`, keeping the BWF rules code separate from rendering.

The current effective drag area is a tuning baseline. Match calibration requires measured shuttle launch/flight data across speeds and conditions; the sandbox does not claim professional-grade aerodynamic validation yet.

### Phase 2 source layout

- `src/physics/shuttle.ts`: pure shuttle dynamics and trajectory results.
- `src/scene/court.ts`: Three.js regulation court, service lines, net and posts.
- `src/main.ts`: browser scene, camera controls and sandbox UI.
- `tests/physics.test.ts`: deterministic physics tests.
