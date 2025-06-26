"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Heart, Spade, Diamond, Club, Crown, Trash2, RefreshCw, Menu, X, LogOut, Shield, Eye } from "lucide-react"
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

const HAND_TYPES = Object.keys(HAND_RANKINGS)

export default function GameRoom({ socket, roomId, player, onLeave, gameMode }: GameRoomProps) {
  const [players, setPlayers] = useState<GamePlayer[]>([])
  const [currentPlayer, setCurrentPlayer] = useState(0)
  const [turn, setTurn] = useState(1)
  const [discardMode, setDiscardMode] = useState(false)
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

  const myPlayerIndex = players.findIndex((p) => p.id === player.id)
  const isMyTurn = currentPlayer === myPlayerIndex
  const myPlayer = players[myPlayerIndex]
  const enemyPlayer = players.find((p) => p.id !== player.id)

  // Update tactical mode when game mode changes
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
        players: room.players?.map((p) => ({ id: p.id, name: p.name, handSize: p.hand?.length, health: p.health })),
      })

      if (room.players && room.players.length === 2) {
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
            maxCardsPerDiscard: p.maxCardsPerDiscard || 3,
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

    socket.on("cardMarkedForDiscard", ({ playerIndex, cardId, marked }) => {
      setPlayers((prev) => {
        const newPlayers = [...prev]
        const card = newPlayers[playerIndex]?.hand.find((c) => c.id === cardId)
        if (card) {
          card.markedForDiscard = marked
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
      setDiscardMode(false)
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
      setDiscardMode(false)
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
      socket.off("cardMarkedForDiscard")
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

  const getSuitIcon = (suit: string) => {
    switch (suit) {
      case "hearts":
        return <Heart className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />
      case "diamonds":
        return <Diamond className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />
      case "clubs":
        return <Club className="w-3 h-3 sm:w-4 sm:h-4 text-black" />
      case "spades":
        return <Spade className="w-3 h-3 sm:w-4 sm:h-4 text-black" />
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

    if (discardMode) {
      socket.emit("markForDiscard", { roomId, cardId })
    } else {
      socket.emit("selectCard", { roomId, cardId })
    }
  }

  const handleDiscard = () => {
    if (!socket || !isMyTurn) return
    socket.emit("discardCards", { roomId })
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

  const markedForDiscardCount = myPlayer.hand.filter((card) => card.markedForDiscard).length

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-red-900 to-black p-2 sm:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3 sm:mb-4 gap-2">
        <div className="text-white">
          <h1 className="text-lg sm:text-2xl font-bold text-red-400 flex items-center gap-2">
            <Crown className="w-4 h-4 sm:w-6 sm:h-6" />
            Demon's Hand
            {tacticalMode && <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />}
            {currentGameMode === "recycling" && <span className="text-green-400 text-sm">♻️</span>}
          </h1>
          <div className="flex justify-between items-center text-xs sm:text-sm">
            <p>
              Turn {turn} - {isMyTurn ? "Your Turn" : `${enemyPlayer.name}'s Turn`}
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

      {/* Action Buttons */}
      {isMyTurn && (
        <div className="flex flex-col sm:flex-row gap-2 mb-3 sm:mb-4">
          {!discardMode ? (
            <>
              <Button
                onClick={() => setDiscardMode(true)}
                disabled={myPlayer.discardsUsed >= myPlayer.maxDiscards}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-xs sm:text-sm px-2 py-1 sm:px-4 sm:py-2"
              >
                <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                Discard
              </Button>
              {tacticalMode && (
                <Button
                  onClick={handleBuildArmor}
                  disabled={myPlayer.selectedCards.length === 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-xs sm:text-sm px-2 py-1 sm:px-4 sm:py-2"
                >
                  <Shield className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Build Armor ({myPlayer.selectedCards.length})
                </Button>
              )}
              <Button
                onClick={handlePlayHand}
                disabled={myPlayer.selectedCards.length === 0}
                className="flex-1 bg-red-600 hover:bg-red-700 text-xs sm:text-sm px-2 py-1 sm:px-4 sm:py-2"
              >
                Attack ({myPlayer.selectedCards.length} cards)
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={() => setDiscardMode(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-xs sm:text-sm px-2 py-1 sm:px-4 sm:py-2"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDiscard}
                disabled={markedForDiscardCount === 0 || markedForDiscardCount > myPlayer.maxCardsPerDiscard}
                className="flex-1 bg-green-600 hover:bg-green-700 text-xs sm:text-sm px-2 py-1 sm:px-4 sm:py-2"
              >
                <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                Discard ({markedForDiscardCount}/{myPlayer.maxCardsPerDiscard})
              </Button>
            </>
          )}
        </div>
      )}

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
                {enemyPlayer.name} {!isMyTurn && "(Their Turn)"}
              </span>
              <div className="flex items-center gap-1 sm:gap-2">
                <Heart className="w-3 h-3 sm:w-4 sm:h-4 text-red-400" />
                <span className="text-white text-sm sm:text-xl">
                  {enemyPlayer.health}/{enemyPlayer.maxHealth || 100}
                </span>
                {tacticalMode && enemyPlayer.armor > 0 && (
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
                style={{ width: `${(enemyPlayer.health / (enemyPlayer.maxHealth || 100)) * 100}%` }}
              ></div>
            </div>
            {tacticalMode && enemyPlayer.prediction && (
              <div className="text-purple-400 text-xs mt-1">Their Prediction: {enemyPlayer.prediction}</div>
            )}
          </CardContent>
        </Card>
      </div>

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

      {/* Discard Instructions */}
      {discardMode && isMyTurn && (
        <Card className="mb-3 sm:mb-4 bg-orange-900/30 border-orange-500">
          <CardContent className="p-2 sm:p-4 text-center">
            <div className="text-orange-400 font-bold text-xs sm:text-base">
              Select up to {myPlayer.maxCardsPerDiscard} cards to discard
            </div>
            <div className="text-gray-300 text-xs">
              {myPlayer.maxDiscards - myPlayer.discardsUsed} discards left this game
            </div>
          </CardContent>
        </Card>
      )}

      {/* My Hand */}
      <div className="mb-4 sm:mb-6">
        <h3 className="text-white font-bold mb-2 text-sm sm:text-base">Your Hand ({myPlayer.hand.length})</h3>
        <div className="flex gap-1 sm:gap-2 overflow-x-auto pt-2">
          {myPlayer.hand.map((card) => (
            <Card
              key={card.id}
              className={`min-w-[50px] sm:min-w-[80px] cursor-pointer transition-all duration-200 ${
                !isMyTurn
                  ? "bg-[conic-gradient(at_bottom_left,_var(--tw-gradient-stops))] from-orange-300/75 via-orange-200/75 to-orange-100/75 hover:bg-red-100/75 opacity-50 cursor-not-allowed"
                  : discardMode
                    ? card.markedForDiscard
                      ? "bg-red-600 border-red-400 transform -translate-y-1 sm:-translate-y-2"
                      : "bg-[conic-gradient(at_bottom_left,_var(--tw-gradient-stops))] from-orange-300 via-orange-200 to-orange-100 hover:bg-red-100"
                    : card.selected
                      ? "bg-yellow-600 border-yellow-400 transform -translate-y-1 sm:-translate-y-2"
                      : "bg-[conic-gradient(at_bottom_left,_var(--tw-gradient-stops))] from-orange-300 via-orange-200 to-orange-100 hover:bg-gray-100"
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

      {/* Enemy Hand */}
      <div>
        <h3 className="text-white font-bold mb-2 text-sm sm:text-base">
          {enemyPlayer.name}'s Hand ({enemyPlayer.hand.length})
        </h3>
        <div className="flex gap-1 sm:gap-2 overflow-x-auto">
          {enemyPlayer.hand.map((_, index) => (
            <Card key={index} className="min-w-[50px] sm:min-w-[80px] aspect-[9.8/10] bg-gray-800 border-gray-600">
              <CardContent className="p-2 sm:p-3 text-center h-full flex items-center justify-center">
                <div className="text-lg sm:text-2xl">🂠</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

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