import { Bytes } from '@graphprotocol/graph-ts';
import { Solver } from '../../generated/schema';
import { ZERO } from '../utils';

export function getOrCreateSolver(solverAddress: Bytes): Solver {
    let solver = Solver.load(solverAddress);

    if (solver) return solver;

    solver = new Solver(solverAddress);
    solver.totalFills = 0;
    solver.totalVolumeOut = ZERO;
    solver.totalVolumeIn = ZERO;

    return solver;
}
