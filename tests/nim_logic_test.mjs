// G2 Nim core logic tests. Extracts the marked NIM CORE block from the
// single-file page and evaluates it in a VM, so tests exercise the shipped code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../puzzle/nim/index.html', import.meta.url), 'utf8');
const start = html.indexOf('/* === NIM CORE START === */');
const end = html.indexOf('/* === NIM CORE END === */');
assert.ok(start >= 0 && end > start, 'NIM CORE block marked');
const src = html.slice(start, end);
const context = vm.createContext({ console });
vm.runInContext(src, context);
const N = context;

test('nimSum and totalStones are correct', () => {
  assert.equal(N.nimSum([3, 4, 5]), 2);
  assert.equal(N.nimSum([1, 1]), 0);
  assert.equal(N.totalStones([3, 4, 5]), 12);
});

test('legal moves and applyMove preserve pile count', () => {
  const moves = N.legalMoves([2, 3]);
  assert.equal(moves.length, 5);
  for (const move of moves) {
    const next = N.applyMove([2, 3], move);
    assert.equal(next[move.pile], ([2, 3][move.pile]) - move.count);
    assert.ok(next[move.pile] >= 0);
  }
});

test('normal play terminal and P-positions', () => {
  assert.equal(N.winningState([0, 0, 0], false), false);
  assert.equal(N.winningState([1], false), true);
  assert.equal(N.winningState([1, 1], false), false);
  assert.equal(N.winningState([1, 2, 3], false), false);
});

test('normal play: every winning position has a move to a losing position', () => {
  for (let a = 0; a <= 5; a++) for (let b = 0; b <= 5; b++) for (let c = 0; c <= 5; c++) {
    const piles = [a, b, c];
    if (N.totalStones(piles) === 0) continue;
    const winning = N.winningState(piles, false);
    const move = N.bestMove(piles, false);
    const nextLosing = !N.winningState(N.applyMove(piles, move), false);
    assert.equal(nextLosing, winning, `piles ${piles} winning=${winning}`);
    assert.equal(N.nimSum(piles) === 0, !winning, `xor/P-position mismatch: ${piles}`);
  }
});

test('misere play: terminal is winning, all-ones parity is correct', () => {
  assert.equal(N.winningState([0, 0], true), true);
  assert.equal(N.winningState([1], true), false);
  assert.equal(N.winningState([1, 1], true), true);
  assert.equal(N.winningState([1, 1, 1], true), false);
  assert.equal(N.winningState([1, 1, 1, 1], true), true);
});

test('misere play: bestMove is optimal for all small states', () => {
  for (let a = 0; a <= 4; a++) for (let b = 0; b <= 4; b++) for (let c = 0; c <= 4; c++) {
    const piles = [a, b, c];
    if (N.totalStones(piles) === 0) continue;
    const winning = N.winningState(piles, true);
    const move = N.bestMove(piles, true);
    assert.equal(!N.winningState(N.applyMove(piles, move), true), winning, `misere ${piles}`);
  }
});

test('hard AI wins 100 random games against a random player', () => {
  let wins = 0;
  const play = (piles, misere) => {
    let turn = 'ai';
    while (N.totalStones(piles) > 0) {
      const move = turn === 'ai' ? N.bestMove(piles, misere) : N.randomMove(piles);
      piles = N.applyMove(piles, move);
      turn = turn === 'ai' ? 'player' : 'ai';
    }
    // Last mover = previous turn; no stones left means previous mover made last move.
    const lastMover = turn === 'ai' ? 'player' : 'ai';
    if (misere) return lastMover === 'player' ? 'ai' : 'player';
    return lastMover;
  };
  for (let i = 0; i < 100; i++) {
    const initial = N.randomPiles();
    if (play(initial, false) === 'ai') wins++;
  }
  assert.ok(wins >= 95, `AI wins ${wins}/100`);
});
