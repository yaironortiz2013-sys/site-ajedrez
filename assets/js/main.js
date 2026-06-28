
const menuButton = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');

if (menuButton && navLinks) {
  menuButton.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
  });

  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
    });
  });
}

const revealItems = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

revealItems.forEach(item => revealObserver.observe(item));

const filterButtons = document.querySelectorAll('.filter-btn');
const missionCards = document.querySelectorAll('.mission-card');

filterButtons.forEach(button => {
  button.addEventListener('click', () => {
    const selected = button.dataset.filter;
    filterButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    missionCards.forEach(card => {
      const match = selected === 'all' || card.dataset.act === selected;
      card.classList.toggle('is-hidden', !match);
    });
  });
});

const sections = document.querySelectorAll('main section[id]');
const navAnchors = document.querySelectorAll('.nav-links a');

const activeObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const id = entry.target.getAttribute('id');
    navAnchors.forEach(anchor => {
      anchor.classList.toggle('active', anchor.getAttribute('href') === `#${id}`);
    });
  });
}, { rootMargin: '-35% 0px -55% 0px', threshold: 0.02 });

sections.forEach(section => activeObserver.observe(section));

const chessRoot = document.getElementById('chess-board');
const turnLabel = document.getElementById('turn-label');
const gameStatus = document.getElementById('game-status');
const capturedWhite = document.getElementById('captured-white');
const capturedBlack = document.getElementById('captured-black');
const moveLog = document.getElementById('move-log');
const modeButtons = document.querySelectorAll('.mode-btn');
const resetBoardButton = document.querySelector('.reset-board');

if (chessRoot) {
  const icons = {
    w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
    b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
  };
  const names = { k: 'Rey', q: 'Reina', r: 'Torre', b: 'Alfil', n: 'Caballo', p: 'Peón' };
  const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 99 };
  const files = ['a','b','c','d','e','f','g','h'];
  let board = [];
  let turn = 'w';
  let selected = null;
  let legalForSelected = [];
  let captured = { w: [], b: [] };
  let history = [];
  let mode = 'two';
  let gameOver = false;
  let aiThinking = false;

  const cloneBoard = src => src.map(row => row.map(piece => piece ? { ...piece } : null));
  const inBounds = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const other = color => color === 'w' ? 'b' : 'w';
  const squareName = (r, c) => `${files[c]}${8 - r}`;

  function initialBoard() {
    const back = ['r','n','b','q','k','b','n','r'];
    return [
      back.map(type => ({ color: 'b', type })),
      Array.from({ length: 8 }, () => ({ color: 'b', type: 'p' })),
      Array(8).fill(null),
      Array(8).fill(null),
      Array(8).fill(null),
      Array(8).fill(null),
      Array.from({ length: 8 }, () => ({ color: 'w', type: 'p' })),
      back.map(type => ({ color: 'w', type }))
    ];
  }

  function resetGame() {
    board = initialBoard();
    turn = 'w';
    selected = null;
    legalForSelected = [];
    captured = { w: [], b: [] };
    history = [];
    gameOver = false;
    aiThinking = false;
    renderBoard();
    updatePanel('Selecciona una pieza blanca para iniciar.');
  }

  function findKing(color, state = board) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = state[r][c];
        if (p && p.color === color && p.type === 'k') return { r, c };
      }
    }
    return null;
  }

  function pseudoMoves(r, c, state = board, attacksOnly = false) {
    const piece = state[r][c];
    if (!piece) return [];
    const moves = [];
    const add = (toR, toC) => {
      if (!inBounds(toR, toC)) return false;
      const target = state[toR][toC];
      if (!target) { moves.push({ from: { r, c }, to: { r: toR, c: toC }, capture: false }); return true; }
      if (target.color !== piece.color) moves.push({ from: { r, c }, to: { r: toR, c: toC }, capture: true });
      return false;
    };

    if (piece.type === 'p') {
      const dir = piece.color === 'w' ? -1 : 1;
      const start = piece.color === 'w' ? 6 : 1;
      if (!attacksOnly) {
        if (inBounds(r + dir, c) && !state[r + dir][c]) {
          moves.push({ from: { r, c }, to: { r: r + dir, c }, capture: false });
          if (r === start && !state[r + dir * 2][c]) moves.push({ from: { r, c }, to: { r: r + dir * 2, c }, capture: false });
        }
      }
      [-1, 1].forEach(dc => {
        const tr = r + dir, tc = c + dc;
        if (!inBounds(tr, tc)) return;
        const target = state[tr][tc];
        if (attacksOnly || (target && target.color !== piece.color)) {
          moves.push({ from: { r, c }, to: { r: tr, c: tc }, capture: Boolean(target) });
        }
      });
    }

    if (piece.type === 'n') {
      [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr, dc]) => add(r + dr, c + dc));
    }

    if (['b','r','q'].includes(piece.type)) {
      const dirs = [];
      if (['b','q'].includes(piece.type)) dirs.push([-1,-1],[-1,1],[1,-1],[1,1]);
      if (['r','q'].includes(piece.type)) dirs.push([-1,0],[1,0],[0,-1],[0,1]);
      dirs.forEach(([dr, dc]) => {
        let tr = r + dr, tc = c + dc;
        while (inBounds(tr, tc)) {
          if (!add(tr, tc)) break;
          tr += dr; tc += dc;
        }
      });
    }

    if (piece.type === 'k') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr || dc) add(r + dr, c + dc);
        }
      }
    }
    return moves;
  }

  function isSquareAttacked(r, c, byColor, state = board) {
    for (let rr = 0; rr < 8; rr++) {
      for (let cc = 0; cc < 8; cc++) {
        const p = state[rr][cc];
        if (!p || p.color !== byColor) continue;
        if (pseudoMoves(rr, cc, state, true).some(m => m.to.r === r && m.to.c === c)) return true;
      }
    }
    return false;
  }

  function inCheck(color, state = board) {
    const king = findKing(color, state);
    return king ? isSquareAttacked(king.r, king.c, other(color), state) : false;
  }

  function applyMoveOnState(state, move) {
    const next = cloneBoard(state);
    const piece = next[move.from.r][move.from.c];
    next[move.to.r][move.to.c] = piece;
    next[move.from.r][move.from.c] = null;
    if (piece && piece.type === 'p' && (move.to.r === 0 || move.to.r === 7)) piece.type = 'q';
    return next;
  }

  function legalMovesFrom(r, c, state = board) {
    const piece = state[r][c];
    if (!piece) return [];
    return pseudoMoves(r, c, state).filter(move => !inCheck(piece.color, applyMoveOnState(state, move)));
  }

  function allLegalMoves(color, state = board) {
    const moves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = state[r][c];
        if (p && p.color === color) moves.push(...legalMovesFrom(r, c, state));
      }
    }
    return moves;
  }

  function makeMove(move) {
    const piece = board[move.from.r][move.from.c];
    const target = board[move.to.r][move.to.c];
    if (!piece) return;
    if (target) captured[piece.color].push(target);
    board = applyMoveOnState(board, move);
    const movedPiece = board[move.to.r][move.to.c];
    history.push(`${icons[piece.color][piece.type]} ${names[piece.type]} ${squareName(move.from.r, move.from.c)}-${squareName(move.to.r, move.to.c)}${target ? ' captura ' + names[target.type] : ''}${movedPiece.type === 'q' && piece.type === 'p' ? ' corona a Reina' : ''}`);
    turn = other(turn);
    selected = null;
    legalForSelected = [];
    renderBoard();
    evaluateGameState();
  }

  function evaluateMove(move) {
    const target = board[move.to.r][move.to.c];
    let score = target ? values[target.type] * 10 : 0;
    const next = applyMoveOnState(board, move);
    if (inCheck('w', next)) score += 4;
    const piece = board[move.from.r][move.from.c];
    if (piece.type === 'p' && move.to.r === 7) score += 8;
    score += Math.random();
    return score;
  }

  function aiMove() {
    if (mode !== 'cpu' || turn !== 'b' || gameOver) return;
    aiThinking = true;
    updatePanel('La máquina está analizando su jugada.');
    setTimeout(() => {
      const moves = allLegalMoves('b');
      if (!moves.length) { evaluateGameState(); return; }
      moves.sort((a, b) => evaluateMove(b) - evaluateMove(a));
      makeMove(moves[0]);
      aiThinking = false;
    }, 450);
  }

  function evaluateGameState() {
    const moves = allLegalMoves(turn);
    if (!moves.length) {
      gameOver = true;
      if (inCheck(turn)) {
        updatePanel(`Jaque mate. Ganan las ${turn === 'w' ? 'negras' : 'blancas'}.`);
      } else {
        updatePanel('Tablas por ahogado. No hay movimientos legales disponibles.');
      }
      return;
    }
    const checkText = inCheck(turn) ? ' El rey está en jaque.' : '';
    updatePanel(`${turn === 'w' ? 'Blancas' : 'Negras'} juegan.${checkText}`);
    if (mode === 'cpu' && turn === 'b') aiMove();
  }

  function updatePanel(message) {
    turnLabel.textContent = `Turno: ${turn === 'w' ? 'blancas' : 'negras'}`;
    gameStatus.textContent = message;
    capturedWhite.textContent = captured.w.length ? captured.w.map(p => icons[p.color][p.type]).join(' ') : '—';
    capturedBlack.textContent = captured.b.length ? captured.b.map(p => icons[p.color][p.type]).join(' ') : '—';
    moveLog.innerHTML = history.map(item => `<li>${item}</li>`).join('');
    moveLog.scrollTop = moveLog.scrollHeight;
  }

  function renderBoard() {
    const checkedKing = inCheck(turn) ? findKing(turn) : null;
    chessRoot.innerHTML = '';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const square = document.createElement('button');
        square.type = 'button';
        square.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
        square.setAttribute('role', 'gridcell');
        square.setAttribute('aria-label', squareName(r, c));
        const piece = board[r][c];
        const isSelected = selected && selected.r === r && selected.c === c;
        const legal = legalForSelected.find(m => m.to.r === r && m.to.c === c);
        if (isSelected) square.classList.add('selected');
        if (legal) square.classList.add(legal.capture ? 'capture' : 'legal');
        if (checkedKing && checkedKing.r === r && checkedKing.c === c) square.classList.add('in-check');
        if (piece) square.innerHTML = `<span class="piece">${icons[piece.color][piece.type]}</span>`;
        square.addEventListener('click', () => handleSquareClick(r, c));
        chessRoot.appendChild(square);
      }
    }
    updatePanel(gameStatus.textContent || 'Partida lista.');
  }

  function handleSquareClick(r, c) {
    if (gameOver || aiThinking) return;
    const piece = board[r][c];
    if (mode === 'cpu' && turn === 'b') return;

    if (selected) {
      const chosenMove = legalForSelected.find(m => m.to.r === r && m.to.c === c);
      if (chosenMove) {
        makeMove(chosenMove);
        return;
      }
    }

    if (piece && piece.color === turn) {
      selected = { r, c };
      legalForSelected = legalMovesFrom(r, c);
      renderBoard();
      updatePanel(`${names[piece.type]} en ${squareName(r, c)} seleccionado. Movimientos disponibles: ${legalForSelected.length}.`);
    } else {
      selected = null;
      legalForSelected = [];
      renderBoard();
      updatePanel('Selecciona una pieza del color que tiene el turno.');
    }
  }

  modeButtons.forEach(button => {
    button.addEventListener('click', () => {
      modeButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      mode = button.dataset.mode;
      resetGame();
      updatePanel(mode === 'cpu' ? 'Modo contra la máquina activado. Juegan blancas.' : 'Modo dos jugadores activado.');
    });
  });

  resetBoardButton?.addEventListener('click', resetGame);
  resetGame();
}
