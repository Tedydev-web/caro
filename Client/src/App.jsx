import { useState, useEffect, useCallback, useMemo } from "react";
import "./App.css";
import Square from "./Square/Square";
import { io } from "socket.io-client";
import Swal from "sweetalert2";
import fpolyLogo from "./assets/FPT_Polytechnic.png";

// Tạo mảng 30x30
const createBoard = (size) => {
  let board = [];
  for (let i = 0; i < size; i++) {
    let row = [];
    for (let j = 0; j < size; j++) {
      row.push(null);
    }
    board.push(row);
  }
  return board;
};

// Tạo bảng trước khi render component để tránh tính toán lại
const renderFrom = createBoard(30);

const App = () => {
  const [gameState, setGameState] = useState(renderFrom);
  const [currentPlayer, setCurrentPlayer] = useState("circle");
  const [finishedState, setFinishetState] = useState(false);
  const [finishedArrayState, setFinishedArrayState] = useState([]);
  const [playOnline, setPlayOnline] = useState(false);
  const [socket, setSocket] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [opponentName, setOpponentName] = useState(null);
  const [playingAs, setPlayingAs] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastMove, setLastMove] = useState(null);
  // Thêm state để theo dõi ô đang visible trên màn hình
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 900 });
  const [connectionError, setConnectionError] = useState(false);
  const [moveCount, setMoveCount] = useState(0); // Thêm biến đếm nước đi
  const [roomId, setRoomId] = useState(null); // Thêm ID phòng để quản lý

  // Theo dõi trạng thái toàn màn hình
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Hàm bật/tắt chế độ toàn màn hình
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Lỗi khi vào chế độ toàn màn hình: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, []);

  // Tăng giảm mức độ zoom
  const handleZoomIn = useCallback(() => {
    if (zoomLevel < 2) {
      setZoomLevel(prev => Math.min(prev + 0.1, 2));
    }
  }, [zoomLevel]);

  const handleZoomOut = useCallback(() => {
    if (zoomLevel > 0.5) {
      setZoomLevel(prev => Math.max(prev - 0.1, 0.5));
    }
  }, [zoomLevel]);

  const handleResetZoom = useCallback(() => {
    setZoomLevel(1);
  }, []);

  // Theo dõi scroll để chỉ render các ô đang hiển thị
  const handleScroll = useCallback((e) => {
    const container = e.target;
    const BOARD_SIZE = gameState.length;
    const scrollTop = container.scrollTop;
    const scrollLeft = container.scrollLeft;
    const clientHeight = container.clientHeight;
    const clientWidth = container.clientWidth;
    
    // Tính toán dựa trên kích thước của mỗi ô (25px) và gap (1px)
    const cellSize = 26; // 25px + 1px gap
    
    const visibleRowStart = Math.max(0, Math.floor(scrollTop / cellSize));
    const visibleRowEnd = Math.min(BOARD_SIZE, Math.ceil((scrollTop + clientHeight) / cellSize));
    
    const visibleColStart = Math.max(0, Math.floor(scrollLeft / cellSize));
    const visibleColEnd = Math.min(BOARD_SIZE, Math.ceil((scrollLeft + clientWidth) / cellSize));
    
    const start = visibleRowStart * BOARD_SIZE + visibleColStart;
    const end = visibleRowEnd * BOARD_SIZE + visibleColEnd;
    
    setVisibleRange({ start, end });
  }, [gameState.length]);
  
  useEffect(() => {
    const boardElement = document.querySelector('.square-wrapper');
    if (boardElement) {
      boardElement.addEventListener('scroll', handleScroll);
      // Trigger initial calculation
      handleScroll({ target: boardElement });
      
      return () => {
        boardElement.removeEventListener('scroll', handleScroll);
      };
    }
  }, [handleScroll]);

  const checkWinner = useCallback(() => {
    const BOARD_SIZE = gameState.length;
    const WIN_CONDITION = 5;

    // Kiểm tra hàng ngang
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col <= BOARD_SIZE - WIN_CONDITION; col++) {
        let winSequence = true;
        let winningPositions = [];
        
        for (let i = 0; i < WIN_CONDITION; i++) {
          if (
            typeof gameState[row][col + i] !== "string" ||
            (i > 0 && gameState[row][col + i] !== gameState[row][col])
          ) {
            winSequence = false;
            break;
          }
          winningPositions.push({
            id: row * BOARD_SIZE + (col + i),
            direction: "horizontal"
          });
        }
        
        if (winSequence) {
          setFinishedArrayState(winningPositions);
          return gameState[row][col];
        }
      }
    }

    // Kiểm tra hàng dọc
    for (let row = 0; row <= BOARD_SIZE - WIN_CONDITION; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        let winSequence = true;
        let winningPositions = [];
        
        for (let i = 0; i < WIN_CONDITION; i++) {
          if (
            typeof gameState[row + i][col] !== "string" ||
            (i > 0 && gameState[row + i][col] !== gameState[row][col])
          ) {
            winSequence = false;
            break;
          }
          winningPositions.push({
            id: (row + i) * BOARD_SIZE + col,
            direction: "vertical"
          });
        }
        
        if (winSequence) {
          setFinishedArrayState(winningPositions);
          return gameState[row][col];
        }
      }
    }

    // Kiểm tra đường chéo xuống phải
    for (let row = 0; row <= BOARD_SIZE - WIN_CONDITION; row++) {
      for (let col = 0; col <= BOARD_SIZE - WIN_CONDITION; col++) {
        let winSequence = true;
        let winningPositions = [];
        
        for (let i = 0; i < WIN_CONDITION; i++) {
          if (
            typeof gameState[row + i][col + i] !== "string" ||
            (i > 0 && gameState[row + i][col + i] !== gameState[row][col])
          ) {
            winSequence = false;
            break;
          }
          winningPositions.push({
            id: (row + i) * BOARD_SIZE + (col + i),
            direction: "diagonal-right"
          });
        }
        
        if (winSequence) {
          setFinishedArrayState(winningPositions);
          return gameState[row][col];
        }
      }
    }

    // Kiểm tra đường chéo xuống trái
    for (let row = 0; row <= BOARD_SIZE - WIN_CONDITION; row++) {
      for (let col = WIN_CONDITION - 1; col < BOARD_SIZE; col++) {
        let winSequence = true;
        let winningPositions = [];
        
        for (let i = 0; i < WIN_CONDITION; i++) {
          if (
            typeof gameState[row + i][col - i] !== "string" ||
            (i > 0 && gameState[row + i][col - i] !== gameState[row][col])
          ) {
            winSequence = false;
            break;
          }
          winningPositions.push({
            id: (row + i) * BOARD_SIZE + (col - i),
            direction: "diagonal-left"
          });
        }
        
        if (winSequence) {
          setFinishedArrayState(winningPositions);
          return gameState[row][col];
        }
      }
    }

    // Kiểm tra hòa
    const isDrawMatch = gameState.flat().every((e) => {
      if (e === "circle" || e === "cross") return true;
    });

    if (isDrawMatch) return "draw";

    return null;
  }, [gameState]);

  useEffect(() => {
    const winner = checkWinner();
    if (winner) {
      setFinishetState(winner);
    }
  }, [gameState, checkWinner]);

  const takePlayerName = useCallback(async () => {
    const result = await Swal.fire({
      title: 'Nhập email của bạn',
      input: 'text',
      inputPlaceholder: 'email người chơi',
      showCancelButton: true,
      confirmButtonText: 'Bắt đầu',
      cancelButtonText: 'Hủy',
      background: '#0c0c14',
      color: '#ffffff',
      confirmButtonColor: '#5654ff',
      cancelButtonColor: '#3634a8',
      inputValidator: (value) => {
        if (!value) {
          return 'Vui lòng nhập email của bạn!';
        }
      },
    });

    return result;
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleOpponentLeftMatch = () => {
      setFinishetState("opponentLeftMatch");
    };

    const handlePlayerMoveFromServer = (data) => {
      console.log("[DEBUG] Received move from server:", data);
      const { rowIndex, colIndex, sign } = data.state;
      
      setGameState(prevState => {
        const newState = JSON.parse(JSON.stringify(prevState));
        newState[rowIndex][colIndex] = sign;
        return newState;
      });
      
      // Cập nhật nước đi cuối cùng
      const BOARD_SIZE = gameState.length;
      const moveId = rowIndex * BOARD_SIZE + colIndex;
      setLastMove(moveId);
      
      // Cập nhật lượt
      setCurrentPlayer(sign === "circle" ? "cross" : "circle");
    };

    const handleConnect = () => {
      setPlayOnline(true);
    };

    const handleOpponentNotFound = () => {
      setOpponentName(false);
    };

    const handleOpponentFound = (data) => {
      setPlayingAs(data.playingAs);
      setOpponentName(data.opponentName);
      setRoomId(data.roomId); // Lưu roomId
    };
    
    const handleSyncGameState = (data) => {
      console.log("[DEBUG] Đồng bộ trạng thái trò chơi:", data);
      
      // Đồng bộ trạng thái bảng
      if (data.gameState) {
        setGameState(data.gameState);
      }
      
      // Đồng bộ lượt chơi hiện tại
      if (data.currentPlayer) {
        setCurrentPlayer(data.currentPlayer);
      }
      
      // Đồng bộ nước đi cuối cùng
      if (data.moves && data.moves.length > 0) {
        const lastMoveData = data.moves[data.moves.length - 1];
        const BOARD_SIZE = 30; // Fixed value
        const moveId = lastMoveData.rowIndex * BOARD_SIZE + lastMoveData.colIndex;
        setLastMove(moveId);
        setMoveCount(data.moves.length);
      }
    };

    socket.on("opponentLeftMatch", handleOpponentLeftMatch);
    socket.on("playerMoveFromServer", handlePlayerMoveFromServer);
    socket.on("connect", handleConnect);
    socket.on("OpponentNotFound", handleOpponentNotFound);
    socket.on("OpponentFound", handleOpponentFound);
    socket.on("syncGameState", handleSyncGameState);

    return () => {
      socket.off("opponentLeftMatch", handleOpponentLeftMatch);
      socket.off("playerMoveFromServer", handlePlayerMoveFromServer);
      socket.off("connect", handleConnect);
      socket.off("OpponentNotFound", handleOpponentNotFound);
      socket.off("OpponentFound", handleOpponentFound);
      socket.off("syncGameState", handleSyncGameState);
    };
  }, [socket, gameState.length]);

  useEffect(() => {
    if (!socket) return;
    
    const handleDisconnect = () => {
      // Hiển thị thông báo mất kết nối
      setConnectionError(true);
      
      // Thử kết nối lại sau 3 giây
      setTimeout(() => {
        socket.connect();
      }, 3000);
    };
    
    const handleReconnect = () => {
      setConnectionError(false);
      
      // Yêu cầu đồng bộ dữ liệu khi kết nối lại
      if (roomId) {
        socket.emit("requestGameSync", {
          roomId: roomId,
          playingAs: playingAs
        });
      }
    };
    
    socket.on("disconnect", handleDisconnect);
    socket.on("connect", handleReconnect);
    
    return () => {
      socket.off("disconnect", handleDisconnect);
      socket.off("connect", handleReconnect);
    };
  }, [socket, playingAs, roomId]);

  const playOnlineClick = useCallback(async () => {
    const result = await takePlayerName();

    if (!result.isConfirmed) {
      return;
    }

    const username = result.value;
    setPlayerName(username);

    const newSocket = io("http://localhost:3000", {
      autoConnect: true,
    });

    newSocket?.emit("request_to_play", {
      playerName: username,
    });

    setSocket(newSocket);
  }, [takePlayerName]);

  const handleSquareClick = useCallback((id, sign) => {
    console.log("[DEBUG] Local click:", { id, sign, rowIndex: Math.floor(id / gameState.length), colIndex: id % gameState.length });
    const BOARD_SIZE = gameState.length;
    const rowIndex = Math.floor(id / BOARD_SIZE);
    const colIndex = id % BOARD_SIZE;
    
    // Kiểm tra xem ô đã được đánh chưa
    if (gameState[rowIndex][colIndex]) {
      console.log("Ô đã được đánh");
      return;
    }
    
    // Kiểm tra lượt chơi có đúng không
    if (currentPlayer !== playingAs) {
      console.log("Không phải lượt của bạn");
      return;
    }
    
    // Cập nhật UI của máy hiện tại (optimistic update)
    setGameState(prevState => {
      const newState = JSON.parse(JSON.stringify(prevState));
      newState[rowIndex][colIndex] = sign;
      return newState;
    });
    
    // Cập nhật nước đi cuối cùng
    setLastMove(id);
    
    // Tăng số lượt đánh
    setMoveCount(prev => prev + 1);
    
    // Chuyển lượt (client side)
    setCurrentPlayer(prev => prev === "circle" ? "cross" : "circle");
    
    // Gửi thông tin đầy đủ đến server
    if (socket) {
      socket.emit("playerMoveFromClient", {
        state: {
          rowIndex,
          colIndex,
          sign,
          moveNumber: moveCount + 1, // Sử dụng giá trị hiện tại + 1
          timestamp: Date.now()  // Thêm timestamp
        }
      });
    }
  }, [gameState, currentPlayer, playingAs, moveCount, socket]);

  // Render chỉ những ô đang hiển thị
  const renderSquares = useMemo(() => {
    const BOARD_SIZE = gameState.length;
    const squares = [];
    
    for (let rowIndex = 0; rowIndex < BOARD_SIZE; rowIndex++) {
      for (let colIndex = 0; colIndex < BOARD_SIZE; colIndex++) {
        const id = rowIndex * BOARD_SIZE + colIndex;
        
        // Chỉ render các ô trong khoảng visible
        if (id >= visibleRange.start && id <= visibleRange.end) {
          squares.push(
            <Square
              key={id}
              id={id}
              socket={socket}
              playingAs={playingAs}
              gameState={gameState}
              finishedArrayState={finishedArrayState}
              finishedState={finishedState}
              currentPlayer={currentPlayer}
              setCurrentPlayer={setCurrentPlayer}
              setGameState={setGameState}
              currentElement={gameState[rowIndex][colIndex]}
              isLastMove={lastMove === id}
              onSquareClick={handleSquareClick}
            />
          );
        }
      }
    }
    
    return squares;
  }, [gameState, visibleRange, socket, playingAs, finishedArrayState, finishedState, currentPlayer, lastMove, handleSquareClick]);

  if (!playOnline) {
    return (
      <div className="main-div">
        <div className="logo-container">
          <img src={fpolyLogo} alt="FPT Polytechnic Logo" className="logo" />
        </div>
        
        {/* Thêm phần tử hình dạng bay lơ lửng */}
        <div className="floating-shapes">
          <div className="shape shape1"></div>
          <div className="shape shape2"></div>
          <div className="shape shape3"></div>
          <div className="shape shape4"></div>
        </div>
        
        <div className="home-page">
          <div className="home-title-container">
            <h1 className="game-heading">Cờ Caro Cùng FPOLY</h1>
            <p className="home-subtitle">
              Trải nghiệm trò chơi cờ caro trực tuyến với đối thủ từ khắp nơi. 
              Chơi ngay để thách thức kỹ năng và giành chiến thắng!
            </p>
          </div>
          
          <div className="game-features">
            <div className="feature-item">
              <div className="feature-icon">🎮</div>
              <h3 className="feature-title">Chơi Trực Tuyến</h3>
              <p className="feature-desc">Kết nối và đấu với người chơi khác mọi lúc mọi nơi</p>
            </div>
            
            <div className="feature-item">
              <div className="feature-icon">⚡</div>
              <h3 className="feature-title">Thời Gian Thực</h3>
              <p className="feature-desc">Trải nghiệm chơi mượt mà với công nghệ Socket.IO</p>
            </div>
            
            <div className="feature-item">
              <div className="feature-icon">🏆</div>
              <h3 className="feature-title">Chiến Thắng</h3>
              <p className="feature-desc">Xếp 5 quân liên tiếp để giành chiến thắng hấp dẫn</p>
            </div>
          </div>
          
          <button onClick={playOnlineClick} className="playOnline">
            Chơi ngay
          </button>
        </div>
      </div>
    );
  }

  if (playOnline && !opponentName) {
    return (
      <div className="waiting">
        <div className="logo-container">
          <img src={fpolyLogo} alt="FPT Polytechnic Logo" className="logo" />
        </div>
        <p>Đang tìm đối thủ...</p>
      </div>
    );
  }

  // Hiển thị thông báo lỗi kết nối
  if (connectionError) {
    return (
      <div className="connection-error">
        <div className="logo-container">
          <img src={fpolyLogo} alt="FPT Polytechnic Logo" className="logo" />
        </div>
        <div className="error-container">
          <h2>Mất kết nối đến máy chủ</h2>
          <p>Đang cố gắng kết nối lại...</p>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-div">
      <div className="logo-container">
        <img src={fpolyLogo} alt="FPT Polytechnic Logo" className="logo" />
      </div>
      <div className="game-container">
        <h1 className="game-heading">Cờ Caro Cùng FPOLY</h1>
        
        <div className="move-detection">
          <div className="player-info">
            <span className="player-label">Bạn</span>
            <div
              className={`left ${
                currentPlayer === playingAs ? "current-move-" + currentPlayer : ""
              }`}
            >
              {playerName}
              {currentPlayer === playingAs && <span className="turn-indicator">Lượt bạn</span>}
            </div>
          </div>
          <div className="player-info">
            <span className="player-label">Đối thủ</span>
            <div
              className={`right ${
                currentPlayer !== playingAs ? "current-move-" + currentPlayer : ""
              }`}
            >
              {opponentName}
              {currentPlayer !== playingAs && <span className="turn-indicator">Lượt đối thủ</span>}
            </div>
          </div>
        </div>
        
        <div className="board-controls">
          <button onClick={handleZoomOut} className="control-btn" title="Thu nhỏ">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
          </button>
          <button onClick={handleResetZoom} className="control-btn" title="Kích thước mặc định">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 3H3C1.9 3 1 3.9 1 5V19C1 20.1 1.9 21 3 21H21C22.1 21 23 20.1 23 19V5C23 3.9 22.1 3 21 3Z"></path>
              <path d="M7 7L17 17"></path>
              <path d="M17 7L7 17"></path>
            </svg>
          </button>
          <button onClick={handleZoomIn} className="control-btn" title="Phóng to">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="11" y1="8" x2="11" y2="14"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
          </button>
          <button onClick={toggleFullscreen} className="control-btn" title="Toàn màn hình">
            {isFullscreen ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
              </svg>
            )}
          </button>
        </div>
        
        <div className="square-wrapper-container">
          <div 
            className="square-wrapper" 
            style={{ 
              gridTemplateColumns: `repeat(${gameState.length}, minmax(30px, 1fr))`,
              transform: `scale(${zoomLevel})`,
              transition: "transform 0.2s ease"
            }}
          >
            {renderSquares}
          </div>
          <div className="square-wrapper-focus-overlay"></div>
        </div>
        
        {finishedState &&
          finishedState !== "opponentLeftMatch" &&
          finishedState !== "draw" && (
            <h3 className="finished-state">
              {finishedState === playingAs ? "Bạn" : "Đối thủ"} đã chiến thắng!
            </h3>
          )}
        {finishedState &&
          finishedState !== "opponentLeftMatch" &&
          finishedState === "draw" && (
            <h3 className="finished-state">Trận đấu hòa!</h3>
          )}
        
        {!finishedState && opponentName && (
          <div className="opponent-info">
            Bạn đang chơi với {opponentName}
          </div>
        )}
        {finishedState && finishedState === "opponentLeftMatch" && (
          <h3 className="finished-state">Bạn đã thắng, đối thủ đã rời trận!</h3>
        )}
      </div>
    </div>
  );
};

export default App;
