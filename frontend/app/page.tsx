"use client"

import React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Crown, Users, Plus, RefreshCw, Gamepad2, Shield, Recycle } from "lucide-react"
import { io, type Socket } from "socket.io-client"
import GameRoom from "./components/GameRoom"

interface Room {
  id: string
  name: string
  players: number
  maxPlayers: number
  gameMode: string
}

const GAME_MODES = {
  classic: {
    name: "Classic",
    icon: Gamepad2,
    description: "Only replace played cards - 3 discards per game, max 5 cards per discard",
  },
  tactical: { name: "Tactical", icon: Shield, description: "Prediction system, armor building, and tactical combat" },
  recycling: { name: "Redraw", icon: Recycle, description: " Discards replenish after 2 turns 500 HP" },
}

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [playerName, setPlayerName] = useState("")
  const [isConnected, setIsConnected] = useState(false)
  const [rooms, setRooms] = useState<Room[]>([])
  const [newRoomName, setNewRoomName] = useState("")
  const [selectedGameMode, setSelectedGameMode] = useState("classic")
  const [currentRoom, setCurrentRoom] = useState<string | null>(null)
  const [player, setPlayer] = useState<{ id: string; name: string } | null>(null)
  const [showCreateRoom, setShowCreateRoom] = useState(false)
  const [currentRoomGameMode, setCurrentRoomGameMode] = useState("classic")

  useEffect(() => {
    const newSocket = io("https://demhan-server-onrender.com")
    setSocket(newSocket)

    newSocket.on("connect", () => {
      setIsConnected(true)
      console.log("Connected to server")
    })

    newSocket.on("disconnect", () => {
      setIsConnected(false)
      console.log("Disconnected from server")
    })

    newSocket.on("playerSet", ({ id, name }) => {
      setPlayer({ id, name })
      console.log("Player set:", { id, name })
    })

    newSocket.on("roomsList", (roomsList: Room[]) => {
      setRooms(roomsList)
    })

    newSocket.on("roomsUpdated", () => {
      newSocket.emit("getRooms")
    })

    newSocket.on("roomCreated", ({ roomId, room }) => {
      setCurrentRoom(roomId)
      setCurrentRoomGameMode(room.gameMode || selectedGameMode)
      setShowCreateRoom(false)
      setNewRoomName("")
      console.log("Room created with mode:", room.gameMode)
    })

    newSocket.on("playerJoined", ({ room }) => {
      if (room.gameMode) {
        setCurrentRoomGameMode(room.gameMode)
        console.log("Updated room game mode:", room.gameMode)
      }
    })

    newSocket.on("error", (error) => {
      alert(`Error: ${error}`)
    })

    return () => {
      newSocket.close()
    }
  }, [])

  const handleSetPlayerName = () => {
    if (socket && playerName.trim()) {
      socket.emit("setPlayerName", playerName.trim())
    }
  }

  const handleCreateRoom = () => {
    if (socket && newRoomName.trim()) {
      socket.emit("createRoom", { roomName: newRoomName.trim(), gameMode: selectedGameMode })
    }
  }

  const handleJoinRoom = (roomId: string) => {
    if (socket) {
      const room = rooms.find((r) => r.id === roomId)
      if (room) {
        setCurrentRoomGameMode(room.gameMode)
        console.log("Joining room with mode:", room.gameMode)
      }
      socket.emit("joinRoom", roomId)
      setCurrentRoom(roomId)
    }
  }

  const handleLeaveRoom = () => {
    if (socket) {
      socket.emit("leaveRoom")
      setCurrentRoom(null)
      setCurrentRoomGameMode("classic")
    }
  }

  const refreshRooms = () => {
    if (socket) {
      socket.emit("getRooms")
    }
  }

  useEffect(() => {
    if (socket && player) {
      socket.emit("getRooms")
    }
  }, [socket, player])

  if (currentRoom && player) {
    return (
      <GameRoom
        socket={socket}
        roomId={currentRoom}
        player={player}
        onLeave={handleLeaveRoom}
        gameMode={currentRoomGameMode}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-red-900 to-black p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Crown className="w-12 h-12 text-red-400" />
            <h1 className="text-4xl md:text-6xl font-bold text-red-400">The Demon's Hand</h1>
          </div>
          <p className="text-gray-300 text-lg">A strategic poker-based combat card game</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}></div>
            <span className="text-sm text-gray-400">{isConnected ? "Connected to server" : "Disconnected"}</span>
          </div>
        </div>

        {!player ? (
          /* Player Name Setup */
          <Card className="max-w-md mx-auto bg-black/50 border-red-500">
            <CardHeader>
              <CardTitle className="text-red-400 text-center">Enter Your Name</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSetPlayerName()}
                className="bg-gray-800 border-gray-600 text-white"
              />
              <Button
                onClick={handleSetPlayerName}
                disabled={!playerName.trim() || !isConnected}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                Join Game
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Welcome Message */}
            <Card className="bg-black/30 border-red-500">
              <CardContent className="p-4 text-center">
                <h2 className="text-xl text-white mb-2">Welcome, {player.name}!</h2>
                <p className="text-gray-300">Choose a game mode and join or create a room to start playing.</p>
              </CardContent>
            </Card>

            {/* Game Modes */}
            <Card className="bg-black/30 border-purple-500">
              <CardHeader>
                <CardTitle className="text-purple-400 flex items-center gap-2">
                  <Gamepad2 className="w-5 h-5" />
                  Game Modes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(GAME_MODES).map(([key, mode]) => {
                    const IconComponent = mode.icon
                    return (
                      <Card
                        key={key}
                        className={`cursor-pointer transition-all ${
                          selectedGameMode === key
                            ? "bg-purple-600/30 border-purple-400"
                            : "bg-gray-800/50 border-gray-600 hover:border-purple-500"
                        }`}
                        onClick={() => setSelectedGameMode(key)}
                      >
                        <CardContent className="p-4 text-center">
                          <IconComponent className="w-8 h-8 mx-auto mb-2 text-purple-400" />
                          <h3 className="text-white font-bold mb-1">{mode.name}</h3>
                          <p className="text-gray-300 text-xs">{mode.description}</p>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Room Management */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Available Rooms */}
              <Card className="bg-black/30 border-blue-500">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-blue-400 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Available Rooms
                  </CardTitle>
                  <Button onClick={refreshRooms} size="sm" className="bg-blue-600 hover:bg-blue-700">
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {rooms.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">No rooms available</p>
                  ) : (
                    <div className="space-y-2">
                      {rooms.map((room) => (
                        <div
                          key={room.id}
                          className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-600"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-white font-medium">{room.name}</h3>
                              <Badge variant="outline" className="text-xs">
                                {GAME_MODES[room.gameMode as keyof typeof GAME_MODES]?.name || room.gameMode}
                              </Badge>
                            </div>
                            <p className="text-gray-400 text-sm">
                              {room.players}/{room.maxPlayers} players
                            </p>
                          </div>
                          <Button
                            onClick={() => handleJoinRoom(room.id)}
                            disabled={room.players >= room.maxPlayers}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Join
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Create Room */}
              <Card className="bg-black/30 border-green-500">
                <CardHeader>
                  <CardTitle className="text-green-400 flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    Create New Room
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-white text-sm mb-2 block">Room Name</label>
                    <Input
                      placeholder="Enter room name"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      className="bg-gray-800 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-white text-sm mb-2 block">Selected Mode</label>
                    <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-600">
                      <div className="flex items-center gap-2">
                        {React.createElement(GAME_MODES[selectedGameMode as keyof typeof GAME_MODES].icon, {
                          className: "w-5 h-5 text-purple-400",
                        })}
                        <span className="text-white font-medium">
                          {GAME_MODES[selectedGameMode as keyof typeof GAME_MODES].name}
                        </span>
                      </div>
                      <p className="text-gray-300 text-xs mt-1">
                        {GAME_MODES[selectedGameMode as keyof typeof GAME_MODES].description}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleCreateRoom}
                    disabled={!newRoomName.trim()}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    Create Room
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}