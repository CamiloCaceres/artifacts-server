// server/index.ts
import express from 'express';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { GameBotManager } from './botManager';
import { config } from 'dotenv';

config(); // Load environment variables

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Initialize bot manager
const botManager = new GameBotManager(process.env.API_TOKEN!);

// Track connected clients
const connectedClients = new Set<string>();

// Socket.IO connection handling
io.on('connection', (socket) => {
  connectedClients.add(socket.id);
  console.log('Client connected');

  // Send initial state including configurations
  socket.emit('initialState', {
    botsStatus: botManager.getBotsStatus(),
    botsConfig: botManager.getAllConfigs(),
    recentLogs: botManager.getRecentLogs(50) // Send last 50 logs
  });

  // Start individual bot
  socket.on('startBot', (characterName: string) => {
    botManager.startBot(characterName);
    io.emit('botStatus', {
      characterName,
      status: botManager.getBotStatus(characterName)
    });
  });

  // Stop individual bot
  socket.on('stopBot', (characterName: string) => {
    botManager.stopBot(characterName);
    io.emit('botStatus', {
      characterName,
      status: botManager.getBotStatus(characterName)
    });
  });

  // Start all bots
  socket.on('startAllBots', () => {
    botManager.startAllBots();
    io.emit('botsStatus', botManager.getBotsStatus());
  });

  // Stop all bots
  socket.on('stopAllBots', () => {
    botManager.stopAllBots();
    io.emit('botsStatus', botManager.getBotsStatus());
  });

  // Handle bot configuration updates
  socket.on('updateBotConfig', ({ characterName, config }) => {
    botManager.updateBotConfig(characterName, config);
    io.emit('botConfigUpdate', {
      characterName,
      config: botManager.getBotConfig(characterName)
    });
  });

  // Handle requests for current bot configuration
  socket.on('getBotConfig', (characterName) => {
    socket.emit('botConfig', {
      characterName,
      config: botManager.getBotConfig(characterName)
    });
  });

  // Handle requests for all bot configurations
  socket.on('getAllConfigs', () => {
    socket.emit('allConfigs', botManager.getAllConfigs());
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    connectedClients.delete(socket.id);
    console.log('Client disconnected');
  });
});

// Status update broadcasting
botManager.on('statusUpdate', (update) => {
  io.emit('botStatus', update);
});

// Log broadcasting
botManager.on('log', (log) => {
  io.emit('botLog', log);
});

// Configuration update broadcasting
botManager.on('configUpdate', (update) => {
  io.emit('botConfigUpdate', update);
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});