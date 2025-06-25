"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Crown, Users, Plus, LogIn, Wifi } from "lucide-react"
import { io, type Socket } from "socket.io-client"
import GameRoom from "./components/GameRoom"

interface Room {
  id: string
  name: string
  players: number
  maxPlayers: number
}

interface Player {
  id: string
  name: string
}

export default function DemonsHandLobby() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [playerName, setPlayerName] = useState("")
  const [player, setPlayer] = useState<Player | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [currentRoom, setCurrentRoom] = useState<string | null>(null)
  const [newRoomName, setNewRoomName] = useState("")
  const [gameState, setGameState] = useState<"lobby" | "room" | "game">("lobby")

  useEffect(() => {
    const newSocket = io("http://localhost:3001")
    setSocket(newSocket)

    newSocket.on("connect", () => {
      setConnected(true)
      console.log("Connected to server")
    })

    newSocket.on("disconnect", () => {
      setConnected(false)
      console.log("Disconnected from server")
    })

    newSocket.on("playerSet", (playerData: Player) => {
      setPlayer(playerData)
    })

    newSocket.on("roomsList", (roomsList: Room[]) => {
      setRooms(roomsList)
    })

    newSocket.on("roomCreated", ({ roomId }: { roomId: string }) => {
      setCurrentRoom(roomId)
      setGameState("room")
    })

    newSocket.on("playerJoined", () => {
      setGameState("room")
    })

    newSocket.on("gameStarted", () => {
      setGameState("game")
    })

    newSocket.on("roomsUpdated", () => {
      if (gameState === "lobby") {
        newSocket.emit("getRooms")
      }
    })

    newSocket.on("error", (message: string) => {
      alert(message)
    })

    return () => {
      newSocket.close()
    }
  }, [])

  useEffect(() => {
    if (socket && connected && gameState === "lobby") {
      socket.emit("getRooms")
    }
  }, [socket, connected, gameState])

  const handleSetName = () => {
    if (socket && playerName.trim()) {
      socket.emit("setPlayerName", playerName.trim())
    }
  }

  const handleCreateRoom = () => {
    if (socket && newRoomName.trim()) {
      socket.emit("createRoom", newRoomName.trim())
      setNewRoomName("")
    }
  }

  const handleJoinRoom = (roomId: string) => {
    if (socket) {
      setCurrentRoom(roomId)
      socket.emit("joinRoom", roomId)
    }
  }

  const handleLeaveRoom = () => {
    if (socket) {
      socket.emit("leaveRoom")
      setCurrentRoom(null)
      setGameState("lobby")
    }
  }

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 via-red-900 to-black flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-black/50 border-red-500">
          <CardContent className="p-8 text-center">
            <Wifi className="w-12 h-12 mx-auto mb-4 text-red-400 animate-pulse" />
            <h1 className="text-2xl font-bold text-red-400 mb-2">Connecting...</h1>
            <p className="text-gray-300">Connecting to game server</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 via-red-900 to-black flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-black/50 border-red-500">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <Crown className="w-12 h-12 mx-auto mb-4 text-red-400" />
              <h1 className="text-2xl font-bold text-red-400 mb-2">The Demon's Hand</h1>
              <p className="text-gray-300">Enter your name to join</p>
            </div>

            <div className="space-y-4">
              <Input
                type="text"
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSetName()}
                className="bg-gray-800 border-gray-600 text-white"
              />
              <Button
                onClick={handleSetName}
                disabled={!playerName.trim()}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                Join Game
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (gameState === "game" && currentRoom) {
    return <GameRoom socket={socket} roomId={currentRoom} player={player} onLeave={handleLeaveRoom} />
  }

  if (gameState === "room") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 via-red-900 to-black flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-black/50 border-red-500">
          <CardContent className="p-8 text-center">
            <Crown className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <h1 className="text-2xl font-bold text-red-400 mb-2">Waiting for Players</h1>
            <p className="text-gray-300 mb-6">Waiting for another player to join...</p>
            <div className="animate-pulse text-yellow-400 mb-6">
              <Users className="w-8 h-8 mx-auto mb-2" />
              <p>1/2 Players</p>
            </div>
            <Button onClick={handleLeaveRoom} className="bg-gray-600 hover:bg-gray-700">
              Leave Room
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-red-900 to-black p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Crown className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h1 className="text-4xl font-bold text-red-400 mb-2">The Demon's Hand</h1>
          <p className="text-gray-300">Multiplayer Poker Combat</p>
          <p className="text-sm text-gray-400 mt-2">Welcome, {player.name}!</p>
        </div>

        {/* Create Room */}
        <Card className="mb-6 bg-black/30 border-red-500">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create New Room
            </h2>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Room name"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleCreateRoom()}
                className="flex-1 bg-gray-800 border-gray-600 text-white"
              />
              <Button onClick={handleCreateRoom} disabled={!newRoomName.trim()} className="bg-red-600 hover:bg-red-700">
                Create
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Available Rooms */}
        <Card className="bg-black/30 border-red-500">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Available Rooms
            </h2>

            {rooms.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">No rooms available</p>
                <p className="text-sm text-gray-500 mt-2">Create a room to start playing!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-600"
                  >
                    <div>
                      <h3 className="text-white font-semibold">{room.name}</h3>
                      <p className="text-sm text-gray-400">
                        {room.players}/{room.maxPlayers} players
                      </p>
                    </div>
                    <Button
                      onClick={() => handleJoinRoom(room.id)}
                      disabled={room.players >= room.maxPlayers}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600"
                    >
                      <LogIn className="w-4 h-4 mr-2" />
                      Join
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connection Status */}
        <div className="text-center mt-6">
          <div className="flex items-center justify-center gap-2 text-green-400">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm">Connected to server</span>
          </div>
        </div>
      </div>
    </div>
  )
}
