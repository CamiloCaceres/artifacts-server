// server/index.ts
import express from "express";
import { Server } from "socket.io";
import { createServer } from "http";
import { GameBotManager } from "./botManager";
import { config } from "dotenv";
import { CraftingCycle } from "./types";

config(); // Load environment variables

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// Initialize bot manager
const botManager = new GameBotManager(process.env.API_TOKEN!);

// Track connected clients
const connectedClients = new Set<string>();

// Socket.IO connection handling
io.on("connection", (socket) => {
  connectedClients.add(socket.id);
  console.log("Client connected");

  // Send initial state including configurations
  socket.emit("initialState", {
    botsStatus: botManager.getBotsStatus(),
    botsConfig: botManager.getAllConfigs(),
    recentLogs: botManager.getRecentLogs(50), // Send last 50 logs
  });

  // Bot Control Events
  socket.on("startBot", (characterName: string) => {
    botManager.startBot(characterName);
    io.emit("botStatus", {
      characterName,
      status: botManager.getBotStatus(characterName),
    });
  });

  socket.on("stopBot", (characterName: string) => {
    botManager.stopBot(characterName);
    io.emit("botStatus", {
      characterName,
      status: botManager.getBotStatus(characterName),
    });
  });

  socket.on("startAllBots", () => {
    botManager.startAllBots();
    io.emit("botsStatus", botManager.getBotsStatus());
  });

  socket.on("stopAllBots", () => {
    botManager.stopAllBots();
    io.emit("botsStatus", botManager.getBotsStatus());
  });

  // Configuration Events
  socket.on("updateBotConfig", ({ characterName, config }) => {
    botManager.updateBotConfig(characterName, config);
    io.emit("botConfigUpdate", {
      characterName,
      config: botManager.getBotConfig(characterName),
    });
  });

  // Crafting-specific Events
  socket.on(
    "updateCraftingCycle",
    ({
      characterName,
      cycle,
    }: {
      characterName: string;
      cycle: CraftingCycle;
    }) => {
      const currentConfig = botManager.getBotConfig(characterName);
      if (currentConfig) {
        botManager.updateBotConfig(characterName, {
          ...currentConfig,
          actionType: "craft",
          craftingCycle: cycle,
        });

        io.emit("botConfigUpdate", {
          characterName,
          config: botManager.getBotConfig(characterName),
        });
      }
    }
  );

  socket.on("removeCraftingCycle", (characterName: string) => {
    const currentConfig = botManager.getBotConfig(characterName);
    if (currentConfig) {
      const { craftingCycle, ...configWithoutCycle } = currentConfig;
      botManager.updateBotConfig(characterName, configWithoutCycle);

      io.emit("botConfigUpdate", {
        characterName,
        config: botManager.getBotConfig(characterName),
      });
    }
  });

  socket.on("getBotConfig", (characterName: string) => {
    socket.emit("botConfig", {
      characterName,
      config: botManager.getBotConfig(characterName),
    });
  });

  socket.on("getAllConfigs", () => {
    socket.emit("allConfigs", botManager.getAllConfigs());
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    connectedClients.delete(socket.id);
    console.log("Client disconnected");
  });
});

// Status update broadcasting
botManager.on("statusUpdate", (update) => {
  io.emit("botStatus", update);
});

// Log broadcasting
botManager.on("log", (log) => {
  io.emit("botLog", log);
});

// Configuration update broadcasting
botManager.on("configUpdate", (update) => {
  io.emit("botConfigUpdate", update);
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Add error handling for the server
httpServer.on("error", (error) => {
  console.error("Server error:", error);
});

// Handle process termination
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  botManager.stopAllBots();
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received. Shutting down gracefully...");
  botManager.stopAllBots();
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
