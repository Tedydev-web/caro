import React, { memo, useMemo, useCallback } from 'react';
import "./Square.css";

const circleSvg = (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
    <g
      id="SVGRepo_tracerCarrier"
      strokeLinecap="round"
      strokeLinejoin="round"
    ></g>
    <g id="SVGRepo_iconCarrier">
      {" "}
      <path
        d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      ></path>{" "}
    </g>
  </svg>
);

const crossSvg = (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
    <g
      id="SVGRepo_tracerCarrier"
      strokeLinecap="round"
      strokeLinejoin="round"
    ></g>
    <g id="SVGRepo_iconCarrier">
      {" "}
      <path
        d="M19 5L5 19M5.00001 5L19 19"
        stroke="#ffffff"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      ></path>{" "}
    </g>
  </svg>
);

const Square = memo(function Square({
  id,
  gameState,
  setGameState,
  socket,
  playingAs,
  currentPlayer,
  finishedArrayState,
  setFinishedState,
  finishedState,
  isLastMove,
  onSquareClick
}) {
  const BOARD_SIZE = gameState?.length || 30;
  const rowIndex = Math.floor(id / BOARD_SIZE);
  const colIndex = id % BOARD_SIZE;

  // Kiểm tra ô thắng và lấy hướng
  const winningInfo = useMemo(() => {
    if (!finishedArrayState || !finishedArrayState.length) return { isWinning: false };
    
    // Kiểm tra xem ô hiện tại có phải là ô thắng không
    const winningSquare = finishedArrayState.find(pos => {
      if (typeof pos === 'object' && pos.id === id) {
        return true;
      } else if (typeof pos === 'number' && pos === id) {
        return true;
      }
      return false;
    });
    
    if (winningSquare) {
      return { 
        isWinning: true, 
        direction: typeof winningSquare === 'object' ? winningSquare.direction : 'horizontal'
      };
    }
    
    return { isWinning: false };
  }, [finishedArrayState, id]);

  // Xử lý click
  const clickOnSquare = useCallback(() => {
    // Kiểm tra lượt chơi và điều kiện game
    if (playingAs !== currentPlayer || finishedState) return;
    if (gameState[rowIndex][colIndex]) return; // Ô đã đánh

    // Xử lý nước đi ở phía client hiện tại
    if (onSquareClick) {
      onSquareClick(id, currentPlayer);
    }
  }, [
    id, gameState, rowIndex, colIndex, 
    currentPlayer, playingAs, finishedState, 
    onSquareClick
  ]);

  // Định nghĩa lớp CSS
  const squareClasses = useMemo(() => {
    const classes = ['grid-square'];
    
    if (winningInfo.isWinning) {
      classes.push('winLine');
      classes.push(`win-${winningInfo.direction}`);
    }
    
    if (isLastMove) {
      const value = gameState[rowIndex][colIndex];
      if (value) {
        classes.push(value === 'circle' ? 'current-move-circle' : 'current-move-cross');
      }
    }
    
    return classes.join(' ');
  }, [gameState, rowIndex, colIndex, winningInfo, isLastMove]);

  // Nội dung ô
  const renderContent = useMemo(() => {
    const value = gameState[rowIndex][colIndex];
    if (!value || typeof value === 'number') return null;
    
    return value === 'circle' ? (
      <div className="circle"></div>
    ) : (
      <div className="cross"></div>
    );
  }, [gameState, rowIndex, colIndex]);

  return (
    <div 
      className={squareClasses}
      onClick={clickOnSquare}
      style={{ cursor: (playingAs !== currentPlayer || finishedState) ? 'not-allowed' : 'pointer' }}
      data-position={`${rowIndex},${colIndex}`}
      data-direction={winningInfo.isWinning ? winningInfo.direction : null}
    >
      {renderContent}
    </div>
  );
});

export default Square;
