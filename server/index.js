const express = require("express")
const http = require("http")
const socketIo = require("socket.io")
const cors = require("cors")
const { v4: uuidv4 } = require("uuid")

const app = express()
const server = http.createServer(app)
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
})

app.use(cors())
app.use(express.json())

// Game state
const rooms = new Map()
const players = new Map()

// Game logic functions
function createDeck() {
  const suits = ["hearts", "diamonds", "clubs", "spades"]
  const deck = []

  for (const suit of suits) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({
        id: `${suit}-${rank}-${Math.random()}`,
        suit,
        rank,
        selected: false,
        markedForDiscard: false,
      })
    }
  }

  // Shuffle deck
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }

  return deck
}

function validateHand(cards) {
  if (cards.length === 0) return { valid: false, error: "No cards selected" }

  const sortedCards = [...cards].sort((a, b) => a.rank - b.rank)
  const ranks = sortedCards.map((c) => c.rank)
  const suits = sortedCards.map((c) => c.suit)

  const rankCounts = {}
  ranks.forEach((rank) => {
    rankCounts[rank] = (rankCounts[rank] || 0) + 1
  })

  const counts = Object.values(rankCounts).sort((a, b) => b - a)
  const isFlush = suits.every((suit) => suit === suits[0]) && cards.length === 5
  const isStraight = cards.length === 5 && ranks[4] - ranks[0] === 4 && new Set(ranks).size === 5
  const isLowStraight = cards.length === 5 && ranks.join(",") === "1,2,3,4,5" && new Set(ranks).size === 5
  const isRoyal = isFlush && isStraight && ranks.join(",") === "1,10,11,12,13"

  switch (cards.length) {
    case 1:
      return { valid: true }
    case 2:
      if (counts[0] !== 2) {
        return { valid: false, error: "Two cards must be a pair (same rank)" }
      }
      return { valid: true }
    case 3:
      if (counts[0] !== 3) {
        return { valid: false, error: "Three cards must be three of a kind (same rank)" }
      }
      return { valid: true }
    case 4:
      if (counts[0] === 4) {
        return { valid: true }
      }
      if (counts[0] === 2 && counts[1] === 2) {
        return { valid: true }
      }
      return {
        valid: false,
        error: "Four cards must be either four of a kind or two pair",
      }
    case 5:
      if (isRoyal) return { valid: true }
      if (isFlush && (isStraight || isLowStraight)) return { valid: true }
      if (counts[0] === 3 && counts[1] === 2) return { valid: true }
      if (isFlush) return { valid: true }
      if (isStraight || isLowStraight) return { valid: true }
      return { valid: false, error: "5 cards must form: Straight, Flush, Full House, Straight Flush, or Royal Flush" }
    default:
      return { valid: false, error: `Invalid number of cards: ${cards.length}. Play 1, 2, 3, 4, or 5 cards only.` }
  }
}

function evaluateHand(cards) {
  const HAND_RANKINGS = {
    "Royal Flush": { damage: 50, description: "A, K, Q, J, 10 of same suit" },
    "Straight Flush": { damage: 40, description: "5 consecutive cards of same suit" },
    "Four of a Kind": { damage: 35, description: "4 cards of same rank" },
    "Full House": { damage: 30, description: "3 of a kind + pair" },
    Flush: { damage: 25, description: "5 cards of same suit" },
    Straight: { damage: 20, description: "5 consecutive cards" },
    "Three of a Kind": { damage: 15, description: "3 cards of same rank" },
    "Two Pair": { damage: 10, description: "2 pairs of different ranks" },
    "One Pair": { damage: 5, description: "2 cards of same rank" },
    "High Card": { damage: 1, description: "Highest card" },
  }

  if (cards.length === 0) return { type: "No Cards", damage: 0, description: "No cards selected" }

  const validation = validateHand(cards)
  if (!validation.valid) {
    return { type: "Invalid Hand", damage: 0, description: validation.error || "Invalid combination" }
  }

  const sortedCards = [...cards].sort((a, b) => a.rank - b.rank)
  const ranks = sortedCards.map((c) => c.rank)
  const suits = sortedCards.map((c) => c.suit)

  // Calculate face value damage
  const faceValueDamage = cards.reduce((total, card) => {
    if (card.rank === 1) return total + 14
    if (card.rank === 13) return total + 13
    if (card.rank === 12) return total + 12
    if (card.rank === 11) return total + 11
    return total + card.rank
  }, 0)

  const rankCounts = {}
  ranks.forEach((rank) => {
    rankCounts[rank] = (rankCounts[rank] || 0) + 1
  })

  const counts = Object.values(rankCounts).sort((a, b) => b - a)
  const isFlush = suits.every((suit) => suit === suits[0]) && cards.length === 5
  const isStraight = cards.length === 5 && ranks[4] - ranks[0] === 4 && new Set(ranks).size === 5
  const isLowStraight = cards.length === 5 && ranks.join(",") === "1,2,3,4,5" && new Set(ranks).size === 5
  const isRoyal = isFlush && isStraight && ranks.join(",") === "1,10,11,12,13"

  let handType = ""
  let baseDamage = 0

  if (isRoyal) {
    handType = "Royal Flush"
    baseDamage = HAND_RANKINGS["Royal Flush"].damage
  } else if (isFlush && (isStraight || isLowStraight)) {
    handType = "Straight Flush"
    baseDamage = HAND_RANKINGS["Straight Flush"].damage
  } else if (counts[0] === 4) {
    handType = "Four of a Kind"
    baseDamage = HAND_RANKINGS["Four of a Kind"].damage
  } else if (counts[0] === 3 && counts[1] === 2) {
    handType = "Full House"
    baseDamage = HAND_RANKINGS["Full House"].damage
  } else if (isFlush) {
    handType = "Flush"
    baseDamage = HAND_RANKINGS["Flush"].damage
  } else if (isStraight || isLowStraight) {
    handType = "Straight"
    baseDamage = HAND_RANKINGS["Straight"].damage
  } else if (counts[0] === 3) {
    handType = "Three of a Kind"
    baseDamage = HAND_RANKINGS["Three of a Kind"].damage
  } else if (counts[0] === 2 && counts[1] === 2) {
    handType = "Two Pair"
    baseDamage = HAND_RANKINGS["Two Pair"].damage
  } else if (counts[0] === 2) {
    handType = "One Pair"
    baseDamage = HAND_RANKINGS["One Pair"].damage
  } else {
    handType = "High Card"
    baseDamage = HAND_RANKINGS["High Card"].damage
  }

  const totalDamage = baseDamage + faceValueDamage

  return {
    type: handType,
    damage: totalDamage,
    description: `${HAND_RANKINGS[handType].description} (Base: ${baseDamage} + Face: ${faceValueDamage})`,
  }
}

// Start game function
function startGame(roomId) {
  const room = rooms.get(roomId)
  if (!room || room.players.length !== 2) {
    console.log("❌ Cannot start game - invalid room or not enough players")
    return
  }

  console.log(`🎮 Starting game in room ${roomId}`)

  const deck = createDeck()

  // Initialize players with game data
  room.players.forEach((player, index) => {
    player.health = 100
    player.hand = deck.slice(index * 8, (index + 1) * 8)
    player.selectedCards = []
    player.discardsUsed = 0
    player.maxDiscards = 3
  })

  room.gameState = "playing"
  room.currentPlayer = 0
  room.turn = 1
  room.deck = deck.slice(16) // Remaining cards after dealing

  console.log("✅ Game started, emitting to room:", roomId)
  console.log(
    "📊 Players:",
    room.players.map((p) => ({ id: p.id, name: p.name, handSize: p.hand.length })),
  )

  // Emit to all players in the room AND individually
  const gameData = { room }

  // Broadcast to room
  io.to(roomId).emit("gameStarted", gameData)

  // Also emit to each player individually as backup
  room.players.forEach((player) => {
    io.to(player.id).emit("gameStarted", gameData)
    console.log(`📤 Sent gameStarted to player ${player.name} (${player.id})`)
  })

  console.log("🎯 Game initialization complete")
}

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("User connected:", socket.id)

  // Store player info
  socket.on("setPlayerName", (name) => {
    players.set(socket.id, { id: socket.id, name, roomId: null })
    socket.emit("playerSet", { id: socket.id, name })
    console.log(`Player ${name} (${socket.id}) set name`)
  })

  // Get available rooms
  socket.on("getRooms", () => {
    const availableRooms = Array.from(rooms.values())
      .filter((room) => room.players.length < 2)
      .map((room) => ({
        id: room.id,
        name: room.name,
        players: room.players.length,
        maxPlayers: 2,
      }))
    socket.emit("roomsList", availableRooms)
  })

  // Create room
  socket.on("createRoom", (roomName) => {
    const roomId = uuidv4()
    const player = players.get(socket.id)

    if (!player) {
      socket.emit("error", "Player not found")
      return
    }

    const room = {
      id: roomId,
      name: roomName,
      players: [player],
      gameState: "waiting",
      currentPlayer: 0,
      turn: 1,
      deck: [],
      lastPlayedHand: null,
    }

    rooms.set(roomId, room)
    player.roomId = roomId

    socket.join(roomId)
    socket.emit("roomCreated", { roomId, room })
    io.emit("roomsUpdated")

    console.log(`Room ${roomName} (${roomId}) created by ${player.name}`)
  })

  // Join room
  socket.on("joinRoom", (roomId) => {
    const room = rooms.get(roomId)
    const player = players.get(socket.id)

    if (!room) {
      socket.emit("error", "Room not found")
      return
    }

    if (!player) {
      socket.emit("error", "Player not found")
      return
    }

    if (room.players.length >= 2) {
      socket.emit("error", "Room is full")
      return
    }

    // Check if player is already in room
    if (room.players.find((p) => p.id === socket.id)) {
      socket.emit("error", "You are already in this room")
      return
    }

    room.players.push(player)
    player.roomId = roomId

    socket.join(roomId)
    console.log(`👥 Player ${player.name} joined room ${room.name} (${room.players.length}/2)`)

    // Emit to all players in room
    io.to(roomId).emit("playerJoined", { player, room })
    io.emit("roomsUpdated")

    // Start game if room is full
    if (room.players.length === 2) {
      console.log("🎯 Room full, starting game in 2 seconds...")
      console.log(
        "👥 Both players:",
        room.players.map((p) => ({ id: p.id, name: p.name })),
      )

      setTimeout(() => {
        startGame(roomId)
      }, 2000) // Delay to ensure all clients are ready
    }
  })

  // Game actions
  socket.on("selectCard", ({ roomId, cardId }) => {
    const room = rooms.get(roomId)
    const player = players.get(socket.id)

    if (!room || !player || room.gameState !== "playing") return

    const playerIndex = room.players.findIndex((p) => p.id === socket.id)
    if (playerIndex !== room.currentPlayer) return

    const currentPlayer = room.players[playerIndex]
    const card = currentPlayer.hand.find((c) => c.id === cardId)

    if (card) {
      card.selected = !card.selected
      currentPlayer.selectedCards = currentPlayer.hand.filter((c) => c.selected)

      io.to(roomId).emit("cardSelected", { playerIndex, cardId, selected: card.selected })
    }
  })

  socket.on("markForDiscard", ({ roomId, cardId }) => {
    const room = rooms.get(roomId)
    const player = players.get(socket.id)

    if (!room || !player || room.gameState !== "playing") return

    const playerIndex = room.players.findIndex((p) => p.id === socket.id)
    if (playerIndex !== room.currentPlayer) return

    const currentPlayer = room.players[playerIndex]
    const card = currentPlayer.hand.find((c) => c.id === cardId)

    if (card) {
      card.markedForDiscard = !card.markedForDiscard
      io.to(roomId).emit("cardMarkedForDiscard", { playerIndex, cardId, marked: card.markedForDiscard })
    }
  })

  socket.on("discardCards", ({ roomId }) => {
    const room = rooms.get(roomId)
    const player = players.get(socket.id)

    if (!room || !player || room.gameState !== "playing") return

    const playerIndex = room.players.findIndex((p) => p.id === socket.id)
    if (playerIndex !== room.currentPlayer) return

    const currentPlayer = room.players[playerIndex]
    const markedCards = currentPlayer.hand.filter((c) => c.markedForDiscard)

    if (markedCards.length === 0 || markedCards.length > 5 || currentPlayer.discardsUsed >= 3) return

    // Remove marked cards and draw new ones
    currentPlayer.hand = currentPlayer.hand.filter((c) => !c.markedForDiscard)

    const newCards = room.deck.splice(0, markedCards.length).map((card) => ({
      ...card,
      selected: false,
      markedForDiscard: false,
    }))

    currentPlayer.hand.push(...newCards)
    currentPlayer.discardsUsed++

    // Send updated game state to all players in room
    io.to(roomId).emit("gameStateUpdate", {
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        health: p.health,
        handSize: p.hand.length,
        discardsUsed: p.discardsUsed,
        maxDiscards: p.maxDiscards,
      })),
    })
  })

  socket.on("playHand", ({ roomId }) => {
    const room = rooms.get(roomId)
    const player = players.get(socket.id)

    if (!room || !player || room.gameState !== "playing") return

    const playerIndex = room.players.findIndex((p) => p.id === socket.id)
    if (playerIndex !== room.currentPlayer) return

    const currentPlayer = room.players[playerIndex]
    const enemyPlayer = room.players[1 - playerIndex]

    if (currentPlayer.selectedCards.length === 0) return

    const validation = validateHand(currentPlayer.selectedCards)
    if (!validation.valid) {
      socket.emit("invalidHand", validation.error)
      return
    }

    const handResult = evaluateHand(currentPlayer.selectedCards)

    // Deal damage to enemy
    enemyPlayer.health = Math.max(0, enemyPlayer.health - handResult.damage)

    // Remove played cards
    currentPlayer.hand = currentPlayer.hand.filter((c) => !c.selected)
    const playedCount = currentPlayer.selectedCards.length
    currentPlayer.selectedCards = []

    // Draw cards to get back to 8 cards total
    const cardsNeeded = Math.max(0, 8 - currentPlayer.hand.length)
    const newCards = room.deck.splice(0, cardsNeeded).map((card) => ({
      ...card,
      selected: false,
      markedForDiscard: false,
    }))

    currentPlayer.hand.push(...newCards)

    room.lastPlayedHand = handResult

    // Check for game over
    if (enemyPlayer.health <= 0) {
      room.gameState = "ended"
      io.to(roomId).emit("gameEnded", { winner: currentPlayer, handResult })
      return
    }

    // Switch turns
    room.currentPlayer = 1 - room.currentPlayer
    room.turn++

    // Reset discards for new player
    room.players[room.currentPlayer].discardsUsed = 0

    io.to(roomId).emit("handPlayed", {
      playerIndex,
      handResult,
      newCurrentPlayer: room.currentPlayer,
      turn: room.turn,
      players: room.players.map((p, idx) => ({
        id: p.id,
        name: p.name,
        health: p.health,
        handSize: p.hand.length,
        discardsUsed: p.discardsUsed,
        maxDiscards: p.maxDiscards,
        // Send full hand data to the player who just played to update their UI
        ...(idx === playerIndex ? { hand: p.hand } : {}),
      })),
    })
  })

  // Leave room
  socket.on("leaveRoom", () => {
    const player = players.get(socket.id)
    if (player && player.roomId) {
      const room = rooms.get(player.roomId)
      if (room) {
        room.players = room.players.filter((p) => p.id !== socket.id)
        socket.leave(player.roomId)

        if (room.players.length === 0) {
          rooms.delete(player.roomId)
        } else {
          io.to(player.roomId).emit("playerLeft", { playerId: socket.id })
        }

        player.roomId = null
        io.emit("roomsUpdated")
      }
    }
  })

  // Disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id)

    const player = players.get(socket.id)
    if (player && player.roomId) {
      const room = rooms.get(player.roomId)
      if (room) {
        room.players = room.players.filter((p) => p.id !== socket.id)

        if (room.players.length === 0) {
          rooms.delete(player.roomId)
        } else {
          io.to(player.roomId).emit("playerLeft", { playerId: socket.id })
        }

        io.emit("roomsUpdated")
      }
    }

    players.delete(socket.id)
  })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})