"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Heart, Spade, Diamond, Club, Crown, Trash2, Shield, Eye, Zap, LogOut, Menu, X, ArrowDown01 } from "lucide-react"
import type { Socket } from "socket.io-client"

interface PlayingCard {
  id: string
  suit: "hearts" | "diamonds" | "clubs" | "spades"
  rank: number
  selected: boolean
  markedForDiscard: boolean
}

interface GamePlayer {
  id: string
  name: string
  health: number
  maxHealth?: number
  hand: PlayingCard[]
  selectedCards: PlayingCard[]
  discardsUsed: number
  maxDiscards: number
  maxCardsPerDiscard: number
  armor?: number
  prediction?: string
}

interface HandResult {
  type: string
  damage: number
  description: string
}

interface GameRoomProps {
  socket: Socket | null
  roomId: string
  player: { id: string; name: string }
  onLeave: () => void
  gameMode: string
}

const HAND_RANKINGS = {
  "Royal Flush": { damage: 150, description: "A, K, Q, J, 10 of same suit" },
  "Straight Flush": { damage: 80, description: "5 consecutive cards of same suit" },
  "Four of a Kind": { damage: 60, description: "4 cards of same rank" },
  "Full House": { damage: 45, description: "3 of a kind + pair" },
  Flush: { damage: 30, description: "5 cards of same suit" },
  Straight: { damage: 25, description: "5 consecutive cards" },
  "Three of a Kind": { damage: 20, description: "3 cards of same rank" },
  "Two Pair": { damage: 10, description: "2 pairs of different ranks" },
  "One Pair": { damage: 5, description: "2 cards of same rank" },
  "High Card": { damage: 1, description: "Highest card" },
}

const HAND_TYPES = Object.keys(HAND_RANKINGS)

// Damage calculation function (same as server)
function calculateDamagePreview(cards: PlayingCard[]) {
  if (cards.length === 0) return { type: "No Cards", damage: 0, valid: false }

  // Validate hand first
  const validation = validateHandPreview(cards)
  if (!validation.valid) {
    return { type: "Invalid", damage: 0, valid: false, error: validation.error }
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

  const rankCounts: { [key: number]: number } = {}
  ranks.forEach((rank) => {
    rankCounts[rank] = (rankCounts[rank] || 0) + 1
  })

  const counts = Object.values(rankCounts).sort((a, b) => b - a)
  const isFlush = suits.every((suit) => suit === suits[0]) && cards.length === 5

  // Straight evaluation
  let isStraight = false
  let isLowStraight = false
  let isRoyal = false

  if (cards.length === 5 && new Set(ranks).size === 5) {
    isLowStraight = ranks.join(",") === "1,2,3,4,5"
    if (!isLowStraight) {
      isStraight = ranks[4] - ranks[0] === 4
    }
    isRoyal = isFlush && ranks.join(",") === "1,10,11,12,13"
  }

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
    valid: true,
    baseDamage,
    faceValueDamage,
  }
}

function validateHandPreview(cards: PlayingCard[]) {
  if (cards.length === 0) return { valid: false, error: "No cards selected" }

  const sortedCards = [...cards].sort((a, b) => a.rank - b.rank)
  const ranks = sortedCards.map((c) => c.rank)
  const suits = sortedCards.map((c) => c.suit)

  const rankCounts: { [key: number]: number } = {}
  ranks.forEach((rank) => {
    rankCounts[rank] = (rankCounts[rank] || 0) + 1
  })

  const counts = Object.values(rankCounts).sort((a, b) => b - a)
  const isFlush = suits.every((suit) => suit === suits[0]) && cards.length === 5

  let isStraight = false
  let isLowStraight = false
  let isRoyal = false

  if (cards.length === 5 && new Set(ranks).size === 5) {
    isLowStraight = ranks.join(",") === "1,2,3,4,5"
    if (!isLowStraight) {
      isStraight = ranks[4] - ranks[0] === 4
    }
    isRoyal = isFlush && ranks.join(",") === "1,10,11,12,13"
  }

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

export default function GameRoom({ socket, roomId, player, onLeave, gameMode }: GameRoomProps) {
  const [players, setPlayers] = useState<GamePlayer[]>([])
  const [currentPlayer, setCurrentPlayer] = useState(0)
  const [turn, setTurn] = useState(1)
  const [showRankings, setShowRankings] = useState(false)
  const [lastPlayedHand, setLastPlayedHand] = useState<HandResult | null>(null)
  const [gameEnded, setGameEnded] = useState(false)
  const [winner, setWinner] = useState<GamePlayer | null>(null)
  const [gameLoaded, setGameLoaded] = useState(false)
  const [rematchRequested, setRematchRequested] = useState(false)
  const [waitingForRematch, setWaitingForRematch] = useState(false)
  const [tacticalMode, setTacticalMode] = useState(false)
  const [selectedPrediction, setSelectedPrediction] = useState<string>("")
  const [showPredictionModal, setShowPredictionModal] = useState(false)
  const [currentGameMode, setCurrentGameMode] = useState(gameMode)
  const [sortBy, setSortBy] = useState<"none" | "suit" | "value">("none")

  const myPlayerIndex = players.findIndex((p) => p.id === player.id)
  const isMyTurn = currentPlayer === myPlayerIndex
  const myPlayer = players[myPlayerIndex]
  const enemyPlayer = players.find((p) => p.id !== player.id)

  // Calculate damage preview for selected cards
  const damagePreview = myPlayer ? calculateDamagePreview(myPlayer.selectedCards) : null

  // Update game mode states when game mode changes
  useEffect(() => {
    console.log("🎮 Game mode updated:", currentGameMode)
    setTacticalMode(currentGameMode === "tactical")
  }, [currentGameMode])

  // Update game mode when prop changes
  useEffect(() => {
    console.log("🔄 GameMode prop changed:", gameMode)
    setCurrentGameMode(gameMode)
  }, [gameMode])

  useEffect(() => {
    if (!socket) return

    console.log("🔌 Setting up socket listeners for player:", player.name)

    socket.on("gameStarted", ({ room }) => {
      console.log("🎮 Game started event received by", player.name, ":", {
        roomId: room.id,
        gameMode: room.gameMode,
        playersCount: room.players?.length,
        players: room.players?.map((p) => ({
          id: p.id,
          name: p.name,
          handSize: p.hand?.length,
          health: p.health,
        })),
      })

      if (room.players && room.players.length >= 1) {
        setPlayers(room.players)
        setCurrentPlayer(room.currentPlayer || 0)
        setTurn(room.turn || 1)
        setCurrentGameMode(room.gameMode || "classic")
        setGameLoaded(true)
        console.log("✅ Game state loaded for", player.name, "with mode:", room.gameMode)
      } else {
        console.error("❌ Invalid room data for", player.name, room)
      }
    })

    socket.on("playerJoined", ({ room }) => {
      console.log("👥 Player joined event received by", player.name, ":", {
        gameMode: room.gameMode,
        playersCount: room.players?.length,
        players: room.players?.map((p) => ({ id: p.id, name: p.name })),
      })

      if (room.players) {
        setPlayers(
          room.players.map((p) => ({
            ...p,
            hand: p.hand || [],
            selectedCards: p.selectedCards || [],
            health: p.health || 100,
            maxHealth: p.maxHealth || 100,
            discardsUsed: p.discardsUsed || 0,
            maxDiscards: p.maxDiscards || 3,
            maxCardsPerDiscard: p.maxCardsPerDiscard || 5,
            armor: p.armor || 0,
          })),
        )
        setCurrentGameMode(room.gameMode || "classic")
        console.log("👥 Updated game mode from playerJoined:", room.gameMode)
      }
    })

    socket.on("cardSelected", ({ playerIndex, cardId, selected }) => {
      setPlayers((prev) => {
        const newPlayers = [...prev]
        const card = newPlayers[playerIndex]?.hand.find((c) => c.id === cardId)
        if (card) {
          card.selected = selected
          newPlayers[playerIndex].selectedCards = newPlayers[playerIndex].hand.filter((c) => c.selected)
        }
        return newPlayers
      })
    })

    socket.on("gameStateUpdate", ({ players: updatedPlayers }) => {
      setPlayers((prev) => {
        return prev.map((player, index) => {
          const updatedPlayer = updatedPlayers[index]
          return {
            ...player,
            health: updatedPlayer?.health ?? player.health,
            maxHealth: updatedPlayer?.maxHealth ?? player.maxHealth,
            discardsUsed: updatedPlayer?.discardsUsed ?? player.discardsUsed,
            maxDiscards: updatedPlayer?.maxDiscards ?? player.maxDiscards,
            maxCardsPerDiscard: updatedPlayer?.maxCardsPerDiscard ?? player.maxCardsPerDiscard,
            armor: updatedPlayer?.armor ?? player.armor,
            hand: updatedPlayer?.hand ?? player.hand,
            selectedCards: [],
          }
        })
      })
    })

    socket.on("handPlayed", ({ playerIndex, handResult, newCurrentPlayer, turn: newTurn, players: updatedPlayers }) => {
      setLastPlayedHand(handResult)
      setCurrentPlayer(newCurrentPlayer)
      setTurn(newTurn)

      if (updatedPlayers) {
        setPlayers((prev) => {
          return prev.map((player, index) => {
            const updatedPlayer = updatedPlayers[index]
            return {
              ...player,
              health: updatedPlayer?.health ?? player.health,
              maxHealth: updatedPlayer?.maxHealth ?? player.maxHealth,
              discardsUsed: updatedPlayer?.discardsUsed ?? player.discardsUsed,
              armor: updatedPlayer?.armor ?? player.armor,
              prediction: updatedPlayer?.prediction ?? null,
              selectedCards: [],
              hand: updatedPlayer?.hand ?? player.hand,
            }
          })
        })
      }

      setTimeout(() => {
        setLastPlayedHand(null)
      }, 3000)
    })

    socket.on(
      "armorBuilt",
      ({ playerIndex, armorGained, handResult, newCurrentPlayer, turn: newTurn, players: updatedPlayers }) => {
        setLastPlayedHand({ ...handResult, description: `Built ${armorGained} armor with ${handResult.type}` })
        setCurrentPlayer(newCurrentPlayer)
        setTurn(newTurn)

        if (updatedPlayers) {
          setPlayers((prev) => {
            return prev.map((player, index) => {
              const updatedPlayer = updatedPlayers[index]
              return {
                ...player,
                health: updatedPlayer?.health ?? player.health,
                maxHealth: updatedPlayer?.maxHealth ?? player.maxHealth,
                discardsUsed: updatedPlayer?.discardsUsed ?? player.discardsUsed,
                armor: updatedPlayer?.armor ?? player.armor,
                prediction: updatedPlayer?.prediction ?? null,
                selectedCards: [],
                hand: updatedPlayer?.hand ?? player.hand,
              }
            })
          })
        }

        setTimeout(() => {
          setLastPlayedHand(null)
        }, 3000)
      },
    )

    socket.on("predictionMade", ({ playerIndex, prediction }) => {
      setPlayers((prev) => {
        const newPlayers = [...prev]
        if (newPlayers[playerIndex]) {
          newPlayers[playerIndex].prediction = prediction
        }
        return newPlayers
      })
    })

    socket.on("gameEnded", ({ winner: gameWinner, handResult }) => {
      setLastPlayedHand(handResult)
      setWinner(gameWinner)
      setGameEnded(true)
    })

    socket.on("invalidHand", (error) => {
      alert(error)
    })

    socket.on("playerLeft", () => {
      alert("Your opponent has left the game")
      onLeave()
    })

    socket.on("error", (error) => {
      console.error("Socket error for", player.name, ":", error)
      alert(`Error: ${error}`)
    })

    socket.on("rematchRequested", ({ playerName }) => {
      setWaitingForRematch(true)
    })

    socket.on("rematchAccepted", ({ room }) => {
      setPlayers(room.players)
      setCurrentPlayer(room.currentPlayer || 0)
      setTurn(room.turn || 1)
      setCurrentGameMode(room.gameMode || "classic")
      setGameEnded(false)
      setWinner(null)
      setLastPlayedHand(null)
      setRematchRequested(false)
      setWaitingForRematch(false)
      console.log("🔄 Rematch accepted with mode:", room.gameMode)
    })

    socket.on("rematchDeclined", () => {
      setRematchRequested(false)
      setWaitingForRematch(false)
      alert("Opponent declined the rematch")
    })

    return () => {
      console.log("🧹 Cleaning up socket listeners for", player.name)
      socket.off("gameStarted")
      socket.off("playerJoined")
      socket.off("cardSelected")
      socket.off("gameStateUpdate")
      socket.off("handPlayed")
      socket.off("armorBuilt")
      socket.off("predictionMade")
      socket.off("gameEnded")
      socket.off("invalidHand")
      socket.off("playerLeft")
      socket.off("error")
      socket.off("rematchRequested")
      socket.off("rematchAccepted")
      socket.off("rematchDeclined")
    }
  }, [socket, onLeave, player.name])

  const sortCards = (cards:PlayingCard[], sortType: "none" | "suit" | "value") => {
    if (sortType==="none") return cards

    const cardCopy = [...cards]

    if(sortType === "suit"){
      const suitOrder = { spades: 0, hearts: 1, diamonds: 2, clubs: 3}
      return cardCopy.sort((a,b)=>{
        if(suitOrder[a.suit] !== suitOrder[b.suit]){
          return suitOrder[a.suit] - suitOrder[b.suit]
        }
        return a.rank - b.rank
      })
    }

    if(sortType === "value"){
      return cardCopy.sort((a, b)=>{
        const aValue = a.rank === 1 ? 14 : a.rank
        const bValue = b.rank === 1 ? 14 : b.rank
        return aValue - bValue
      })
    }

    return cards
  }

  const getSuitIcon = (suit: string) => {
    switch (suit) {
      case "hearts":
        return <Heart className="w-4 h-4 sm:w-4 sm:h-4 text-red-500" strokeWidth={3} />
      case "diamonds":
        return <Diamond className="w-4 h-4 sm:w-4 sm:h-4 text-red-500" strokeWidth={3} />
      case "clubs":
        return <Club className="w-4 h-4 sm:w-4 sm:h-4 text-black" strokeWidth={3} />
      case "spades":
        return <Spade className="w-4 h-4 sm:w-4 sm:h-4 text-black" strokeWidth={3} />
      default:
        return null
    }
  }

  const getRankDisplay = (rank: number): string => {
    switch (rank) {
      case 1:
        return "A"
      case 11:
        return "J"
      case 12:
        return "Q"
      case 13:
        return "K"
      default:
        return rank.toString()
    }
  }

  const handleCardClick = (cardId: string) => {
    if (!socket || !isMyTurn) return
    socket.emit("selectCard", { roomId, cardId })
  }

  const handlePlayHand = () => {
    if (!socket || !isMyTurn) return
    socket.emit("playHand", { roomId })
  }

  const handleBuildArmor = () => {
    if (!socket || !isMyTurn || !tacticalMode) return
    socket.emit("buildArmor", { roomId })
  }

  const handleMakePrediction = () => {
    if (!socket || isMyTurn || !tacticalMode || !selectedPrediction) return
    socket.emit("makePrediction", { roomId, prediction: selectedPrediction })
    setShowPredictionModal(false)
    setSelectedPrediction("")
  }

  const handleRematch = () => {
    if (!socket) return
    setRematchRequested(true)
    socket.emit("requestRematch", { roomId })
  }

  const handleAcceptRematch = () => {
    if (!socket) return
    socket.emit("acceptRematch", { roomId })
  }

  const handleDeclineRematch = () => {
    if (!socket) return
    setWaitingForRematch(false)
    socket.emit("declineRematch", { roomId })
  }

  if (!gameLoaded || players.length < 2 || !myPlayer || !enemyPlayer) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 via-red-900 to-black flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-black/50 border-red-500">
          <CardContent className="p-8 text-center">
            <Crown className="w-12 h-12 mx-auto mb-4 text-red-400 animate-pulse" />
            <h1 className="text-2xl font-bold text-red-400 mb-2">Loading Game...</h1>
            <p className="text-gray-300">Setting up the battlefield...</p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="text-gray-400">Players loaded: {players.length}/2</div>
              <div className="text-gray-400">Game loaded: {gameLoaded ? "Yes" : "No"}</div>
              <div className="text-gray-400">Mode: {currentGameMode}</div>
              <div className="text-gray-400">Tactical: {tacticalMode ? "Yes" : "No"}</div>
              <div className="text-gray-400">Room: {roomId}</div>
            </div>
            <Button onClick={onLeave} className="mt-6 bg-gray-600 hover:bg-gray-700">
              Back to Lobby
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-red-900 to-black p-2 sm:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3 sm:mb-4 gap-2">
        <div className="text-white">
          <h1 className="text-lg sm:text-2xl font-bold text-red-400 flex items-center gap-2">
            <Crown className="w-4 h-4 sm:w-6 sm:h-6" />
            The Demon's Hand
            {tacticalMode && <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />}
            {currentGameMode === "recycling" && <span className="text-green-400 text-sm">♻️</span>}
          </h1>
          <div className="flex justify-between items-center text-xs sm:text-sm">
            <p>
              Turn {turn} - {isMyTurn ? "Your Turn" : `${enemyPlayer?.name || "Opponent"}'s Turn`}
            </p>
            <p className="text-gray-300">
              Discards: {myPlayer.discardsUsed}/{myPlayer.maxDiscards} (max {myPlayer.maxCardsPerDiscard}/turn)
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {tacticalMode && !isMyTurn && !myPlayer.prediction && (
            <Button
              onClick={() => setShowPredictionModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-xs px-2 py-1"
            >
              <Eye className="w-3 h-3 mr-1" />
              Predict
            </Button>
          )}
          <Button
            onClick={() => setShowRankings(!showRankings)}
            className="sm:hidden bg-purple-600 hover:bg-purple-700 text-xs px-2 py-1"
          >
            {showRankings ? <X className="w-3 h-3" /> : <Menu className="w-3 h-3" />}
          </Button>
          <Button onClick={onLeave} className="bg-gray-600 hover:bg-gray-700 text-xs px-2 py-1">
            <LogOut className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
            Leave
          </Button>
        </div>
      </div>

      {/* Hand Rankings */}
      {(showRankings || (typeof window !== "undefined" && window.innerWidth >= 640)) && (
        <div className="mb-3 sm:mb-4 bg-black/30 rounded-lg p-2 sm:p-3">
          <h3 className="text-white font-bold mb-2 text-xs sm:text-sm">Rankings (Base + Face):</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 sm:gap-2 text-xs">
            {Object.entries(HAND_RANKINGS).map(([hand, info]) => (
              <div key={hand} className="text-center">
                <div className="text-yellow-400 font-bold text-xs">{hand}</div>
                <div className="text-red-400 text-xs">{info.damage}+</div>
              </div>
            ))}
          </div>
          <div className="mt-1 sm:mt-2 text-xs text-gray-300 text-center">A=14, K=13, Q=12, J=11</div>
        </div>
      )}

      {/* Player Health Bars */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-3 sm:mb-6">
        <Card className="bg-blue-900/30 border-blue-500">
          <CardContent className="p-2 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-white font-bold text-xs sm:text-base">
                {myPlayer.name} {isMyTurn && "(Your Turn)"}
              </span>
              <div className="flex items-center gap-1 sm:gap-2">
                <Heart className="w-3 h-3 sm:w-4 sm:h-4 text-red-400" />
                <span className="text-white text-sm sm:text-xl">
                  {myPlayer.health}/{myPlayer.maxHealth || 100}
                </span>
                {tacticalMode && myPlayer.armor > 0 && (
                  <>
                    <Shield className="w-3 h-3 sm:w-4 sm:h-4 text-blue-400" />
                    <span className="text-blue-400 text-sm sm:text-xl">{myPlayer.armor}</span>
                  </>
                )}
              </div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-1 sm:h-2 mt-1 sm:mt-2">
              <div
                className="bg-red-500 h-1 sm:h-2 rounded-full transition-all duration-300"
                style={{ width: `${(myPlayer.health / (myPlayer.maxHealth || 100)) * 100}%` }}
              ></div>
            </div>
            {tacticalMode && myPlayer.prediction && (
              <div className="text-purple-400 text-xs mt-1">Your Prediction: {myPlayer.prediction}</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-red-900/30 border-red-500">
          <CardContent className="p-2 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-white font-bold text-xs sm:text-base">
                {enemyPlayer?.name || "Opponent"} {!isMyTurn && "(Their Turn)"}
              </span>
              <div className="flex items-center gap-1 sm:gap-2">
                <Heart className="w-3 h-3 sm:w-4 sm:h-4 text-red-400" />
                <span className="text-white text-sm sm:text-xl">
                  {enemyPlayer?.health || 0}/{enemyPlayer?.maxHealth || 100}
                </span>
                {tacticalMode && enemyPlayer?.armor > 0 && (
                  <>
                    <Shield className="w-3 h-3 sm:w-4 sm:h-4 text-blue-400" />
                    <span className="text-blue-400 text-sm sm:text-xl">{enemyPlayer.armor}</span>
                  </>
                )}
              </div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-1 sm:h-2 mt-1 sm:mt-2">
              <div
                className="bg-red-500 h-1 sm:h-2 rounded-full transition-all duration-300"
                style={{ width: `${((enemyPlayer?.health || 0) / (enemyPlayer?.maxHealth || 100)) * 100}%` }}
              ></div>
            </div>
            {tacticalMode && enemyPlayer?.prediction && (
              <div className="text-purple-400 text-xs mt-1">Their Prediction: {enemyPlayer.prediction}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* My Hand */}
      <div className="mb-4 sm:mb-6">
        <div className=" flex justify-between items-center"><h3 className="text-white font-bold mb-2 text-sm sm:text-base">Your Hand ({myPlayer.hand.length})</h3>
        <div className=" flex gap-1 mb-2">
          <Button onClick={()=>setSortBy(sortBy==="suit"?"none":"suit")} className={`${sortBy === "suit" ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'}`}>
            <svg fill="#000000" viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <title>suits</title> <path d="M15.887 12.424c0.515-1.922 5.998-4.38 5.888-7.88-0.108-3.449-4.153-4.34-5.888-1.334-1.694-2.934-6.018-2.173-5.906 1.334 0.117 3.652 5.343 5.781 5.906 7.88zM10.549 24.249l5.334 6.561 5.334-6.561-5.334-6.561zM30.882 15.493c-0.105-3.291-5.321-7.1-5.321-7.1s-5.404 3.947-5.305 7.1c0.085 2.696 2.839 3.657 4.588 2.095l-1.533 3.672 4.516-0-1.534-3.675c1.773 1.523 4.677 0.642 4.589-2.092zM11.923 15.73c0-1.53-1.221-2.787-2.752-2.787-0.131 0-0.257 0.017-0.383 0.035 0.367-0.47 0.592-1.064 0.592-1.707 0-1.53-1.221-2.752-2.752-2.752s-2.786 1.221-2.786 2.752c0 0.638 0.23 1.238 0.592 1.707-0.115-0.014-0.229-0.035-0.348-0.035-1.53 0-2.787 1.256-2.787 2.787s1.256 2.786 2.787 2.786c0.624 0 1.201-0.21 1.665-0.561l-1.398 3.348 4.516-0-1.419-3.398c0.474 0.379 1.073 0.61 1.721 0.61 1.53 0 2.752-1.256 2.752-2.787zM6.629 8.52h0z"></path> </g></svg>
          </Button>
          <Button onClick={()=>setSortBy(sortBy==="value"?"none":"value")} className={`${sortBy === "value" ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'}`}><ArrowDown01 className=" text-black"/></Button>
        </div></div>
        <div className="flex gap-1 sm:gap-2 overflow-x-auto pb-2 items-center justify-center">
          {sortCards(myPlayer.hand, sortBy).map((card) => (
            <Card
              key={card.id}
              className={`min-w-[60px] py-2 sm:py-2 sm:min-w-[70px] cursor-pointer transition-all duration-200 ${
                !isMyTurn
                  ? "opacity-50 cursor-not-allowed"
                  : card.selected
                    ? "bg-yellow-600 border-yellow-400 transform -translate-y-1 sm:-translate-y-2"
                    : "bg-white hover:bg-gray-100 "
              }`}
              onClick={() => handleCardClick(card.id)}
            >
              <CardContent className="p-2 sm:p-3 text-center">
                <div className="text-lg sm:text-2xl font-bold mb-1">{getRankDisplay(card.rank)}</div>
                <div className="flex justify-center">{getSuitIcon(card.suit)}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Damage Preview */}
      {isMyTurn && myPlayer.selectedCards.length > 0 && damagePreview && (
        <Card className="mb-3 sm:mb-4 bg-yellow-900/30 border-yellow-500">
          <CardContent className="p-2 sm:p-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              <div className="text-yellow-400 font-bold text-sm sm:text-lg">
                {damagePreview.valid ? (
                  <>
                    {damagePreview.type} - {damagePreview.damage} DMG
                    <span className="text-xs ml-2">
                      (Base: {damagePreview.baseDamage} + Face: {damagePreview.faceValueDamage})
                    </span>
                  </>
                ) : (
                  <span className="text-red-400">{damagePreview.error || "Invalid Hand"}</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {isMyTurn && (
        <div className="flex flex-col sm:flex-row gap-2 mb-3 sm:mb-4">
          {myPlayer.selectedCards.length > 0 ? (
            // Show options when cards are selected
            <>
              <Button
                onClick={handlePlayHand}
                className="flex-1 bg-red-600 hover:bg-red-700 text-xs sm:text-sm px-2 py-1 sm:px-4 sm:py-2"
              >
                Attack ({myPlayer.selectedCards.length} cards)
              </Button>
              {tacticalMode && (
                <Button
                  onClick={handleBuildArmor}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-xs sm:text-sm px-2 py-1 sm:px-4 sm:py-2"
                >
                  <Shield className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Build Armor
                </Button>
              )}
              <Button
                onClick={() => {
                  if (!socket) return
                  socket.emit("discardCards", { roomId })
                }}
                disabled={
                  myPlayer.discardsUsed >= myPlayer.maxDiscards ||
                  myPlayer.selectedCards.length > myPlayer.maxCardsPerDiscard
                }
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-xs sm:text-sm px-2 py-1 sm:px-4 sm:py-2"
              >
                <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                Discard ({myPlayer.selectedCards.length}/{myPlayer.maxCardsPerDiscard})
              </Button>
            </>
          ) : (
            <>
            </>
          )}
        </div>
      )}

      {/* Last Played Hand */}
      {lastPlayedHand && (
        <Card className="mb-3 sm:mb-4 bg-yellow-900/30 border-yellow-500">
          <CardContent className="p-2 sm:p-4 text-center">
            <div className="text-yellow-400 font-bold text-sm sm:text-lg">
              {lastPlayedHand.type} - {lastPlayedHand.damage} DMG!
            </div>
            <div className="text-gray-300 text-xs sm:text-sm">{lastPlayedHand.description}</div>
          </CardContent>
        </Card>
      )}

      {/* Prediction Modal */}
      {showPredictionModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md bg-black/90 border-purple-500">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold text-purple-400 mb-4">Predict Opponent's Hand</h3>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {HAND_TYPES.map((handType) => (
                  <Button
                    key={handType}
                    onClick={() => setSelectedPrediction(handType)}
                    className={`text-xs p-2 ${
                      selectedPrediction === handType
                        ? "bg-purple-600 border-purple-400"
                        : "bg-gray-700 hover:bg-gray-600"
                    }`}
                  >
                    {handType}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleMakePrediction}
                  disabled={!selectedPrediction}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  Predict
                </Button>
                <Button
                  onClick={() => {
                    setShowPredictionModal(false)
                    setSelectedPrediction("")
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Game Over */}
      {gameEnded && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm bg-black/90 border-red-500">
            <CardContent className="p-6 sm:p-8 text-center">
              <div className="text-4xl sm:text-6xl mb-4">{winner ? "👑" : "🤝"}</div>
              <h2 className="text-xl sm:text-3xl font-bold text-red-400 mb-4">
                {winner ? (winner.id === player.id ? "You Win!" : `${winner.name} Wins!`) : "Draw Game!"}
              </h2>

              {waitingForRematch ? (
                <div className="space-y-4">
                  <p className="text-yellow-400">Opponent wants a rematch!</p>
                  <div className="flex gap-2">
                    <Button onClick={handleAcceptRematch} className="flex-1 bg-green-600 hover:bg-green-700">
                      Accept
                    </Button>
                    <Button onClick={handleDeclineRematch} className="flex-1 bg-red-600 hover:bg-red-700">
                      Decline
                    </Button>
                  </div>
                </div>
              ) : rematchRequested ? (
                <div className="space-y-4">
                  <p className="text-yellow-400">Waiting for opponent...</p>
                  <Button onClick={onLeave} className="w-full bg-gray-600 hover:bg-gray-700">
                    Back to Lobby
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button onClick={handleRematch} className="w-full bg-blue-600 hover:bg-blue-700">
                    Rematch
                  </Button>
                  <Button onClick={onLeave} className="w-full bg-red-600 hover:bg-red-700">
                    Back to Lobby
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}