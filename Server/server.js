const { createServer } = require("http");
const { Server } = require("socket.io");

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const allUsers = {};
const allRooms = [];
const roomStates = {};
const playerRooms = {};

io.on("connection", (socket) => {
  console.log("Người chơi kết nối:", socket.id);
  
  allUsers[socket.id] = {
    socket: socket,
    online: true,
  };

  socket.on("request_to_play", (data) => {
    const currentUser = allUsers[socket.id];
    currentUser.playerName = data.playerName;

    let opponentPlayer;

    for (const key in allUsers) {
      const user = allUsers[key];
      if (user.online && !user.playing && socket.id !== key) {
        opponentPlayer = user;
        break;
      }
    }

    if (opponentPlayer) {
      currentUser.playing = true;
      opponentPlayer.playing = true;
      
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      allRooms.push({
        id: roomId,
        player1: opponentPlayer,
        player2: currentUser,
      });
      
      playerRooms[currentUser.socket.id] = roomId;
      playerRooms[opponentPlayer.socket.id] = roomId;
      
      roomStates[roomId] = {
        gameState: createEmptyBoard(30),
        moves: [],
        currentPlayer: "circle",
        lastMoveTimestamp: Date.now()
      };

      currentUser.socket.emit("OpponentFound", {
        opponentName: opponentPlayer.playerName,
        playingAs: "circle",
        roomId: roomId
      });

      opponentPlayer.socket.emit("OpponentFound", {
        opponentName: currentUser.playerName,
        playingAs: "cross",
        roomId: roomId
      });
      
      currentUser.socket.join(roomId);
      opponentPlayer.socket.join(roomId);
      
      console.log(`Tạo phòng: ${roomId} với người chơi ${currentUser.playerName} và ${opponentPlayer.playerName}`);
    } else {
      currentUser.socket.emit("OpponentNotFound");
    }
  });

  socket.on("disconnect", function () {
    console.log("Người chơi ngắt kết nối:", socket.id);
    
    const currentUser = allUsers[socket.id];
    if (!currentUser) return;
    
    currentUser.online = false;
    currentUser.playing = false;
    
    const roomId = playerRooms[socket.id];
    if (roomId) {
      socket.to(roomId).emit("opponentLeftMatch");
      
      delete roomStates[roomId];
      delete playerRooms[socket.id];
      
      const roomIndex = allRooms.findIndex(room => 
        room.id === roomId
      );
      
      if (roomIndex !== -1) {
        const room = allRooms[roomIndex];
        const otherPlayerId = room.player1.socket.id === socket.id 
          ? room.player2.socket.id 
          : room.player1.socket.id;
        
        delete playerRooms[otherPlayerId];
        allRooms.splice(roomIndex, 1);
      }
    }
  });

  socket.on("playerMoveFromClient", (data) => {
    const roomId = playerRooms[socket.id];
    if (!roomId) {
      console.log("Không tìm thấy phòng cho người chơi:", socket.id);
      return;
    }
    
    const roomState = roomStates[roomId];
    if (!roomState) {
      console.log("Không tìm thấy trạng thái phòng:", roomId);
      return;
    }
    
    const currentPlayer = roomState.currentPlayer;
    const playingAs = data.state.sign;
    
    if (currentPlayer !== playingAs) {
      console.log("Không phải lượt của người chơi:", socket.id);
      return;
    }
    
    const { rowIndex, colIndex, sign } = data.state;
    
    if (roomState.gameState[rowIndex][colIndex] !== null) {
      console.log("Ô đã được đánh:", rowIndex, colIndex);
      return;
    }
    
    roomState.gameState[rowIndex][colIndex] = sign;
    roomState.moves.push({ 
      rowIndex, 
      colIndex, 
      sign, 
      timestamp: Date.now() 
    });
    roomState.currentPlayer = sign === "circle" ? "cross" : "circle";
    roomState.lastMoveTimestamp = Date.now();
    
    io.to(roomId).emit("playerMoveFromServer", {
      state: {
        rowIndex: rowIndex,
        colIndex: colIndex,
        sign: sign
      }
    });
  });

  socket.on("requestGameSync", (data) => {
    const roomId = data.roomId || playerRooms[socket.id];
    if (!roomId || !roomStates[roomId]) return;
    
    socket.emit("syncGameState", roomStates[roomId]);
  });
});

function createEmptyBoard(size) {
  let board = [];
  for (let i = 0; i < size; i++) {
    let row = [];
    for (let j = 0; j < size; j++) {
      row.push(null);
    }
    board.push(row);
  }
  return board;
}

httpServer.listen(3000, () => {
  console.log("Server đang chạy tại http://localhost:3000");
});
