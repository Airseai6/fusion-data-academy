// G3 Hanoi core logic tests. Extracts the marked HANOI CORE block from the
// single-file page and evaluates it in a VM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../puzzle/hanoi/index.html', import.meta.url), 'utf8');
const start = html.indexOf('/* === HANOI CORE START === */');
const end = html.indexOf('/* === HANOI CORE END === */');
assert.ok(start >= 0 && end > start, 'HANOI CORE block marked');
const context = vm.createContext({ console });
vm.runInContext(html.slice(start, end), context);
const H = context;

function startPegs(n) {
  return [Array.from({ length: n }, (_, i) => n - i), [], []];
}

test('minMoves follows 2^n - 1', () => {
  assert.equal(H.minMoves(1), 1);
  assert.equal(H.minMoves(3), 7);
  assert.equal(H.minMoves(6), 63);
});

test('solveHanoi returns the optimal sequence and every move is legal', () => {
  for (let n = 1; n <= 6; n++) {
    const moves = H.solveHanoi(n);
    assert.equal(moves.length, H.minMoves(n), `n=${n}`);
    let pegs = startPegs(n);
    for (const move of moves) {
      const next = H.applyMove(pegs, move.from, move.to);
      assert.ok(next, `illegal move in optimal solution n=${n}: ${JSON.stringify(move)}`);
      pegs = next;
    }
    assert.equal(pegs[2].length, n);
    assert.equal(pegs[0].length, 0);
  }
});

test('shortestPath matches 2^n - 1 from the start state', () => {
  for (let n = 1; n <= 6; n++) {
    const path = H.shortestPath(startPegs(n), 2);
    assert.equal(path.length, H.minMoves(n), `n=${n}`);
    let pegs = startPegs(n);
    for (const move of path) {
      pegs = H.applyMove(pegs, move.from, move.to);
      assert.ok(pegs);
    }
    assert.equal(pegs[2].length, n);
  }
});

test('hintMove is the first step of an optimal path', () => {
  const pegs = startPegs(3);
  const hint = H.hintMove(pegs, 2);
  assert.equal(hint.from, 0);
  assert.equal(hint.to, 2);
  const after = H.applyMove(pegs, hint.from, hint.to);
  assert.equal(H.shortestPath(after, 2).length, 6);
});

test('large disk cannot be placed on small disk', () => {
  const pegs = [[3, 2, 1], [], []];
  assert.equal(H.legalMove(pegs, 0, 2), true);
  assert.equal(H.legalMove(pegs, 0, 1), true);
  assert.equal(H.legalMove(pegs, 1, 0), false);
  const state = [[1], [2], [3]]; // not reachable in normal play, still validates ordering
  assert.equal(H.legalMove(state, 2, 0), false); // disk 3 onto 1 illegal
  assert.equal(H.legalMove(state, 2, 1), false); // disk 3 onto 2 illegal
  assert.equal(H.legalMove(state, 0, 1), true); // disk 1 onto 2 legal
});
