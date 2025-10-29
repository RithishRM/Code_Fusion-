// ---------------------- IMPORTS ----------------------
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const WebSocket = require('ws');

const app = express();
const HTTP_PORT = 5000; // Judge0 proxy
const WS_PORT = 8080;   // WebSocket server


const RAPIDAPI_KEY = 'fe9d4da002msh522e2019629f456p1b5ce4jsn1d09aef7f5a4';

app.use(cors());
app.use(express.json());

// ---------------------- JUDGE0 PROXY (FIXED) ----------------------
app.post('/run', async (req, res) => {
  const { source_code, language_id, stdin = "" } = req.body;
  const base64Stdin = Buffer.from(stdin).toString('base64');

  const base64Source = Buffer.from(source_code).toString('base64');

  try {
    const response = await axios.post(
      'https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=true&wait=true',
      {
        source_code: base64Source, 
        language_id,
        stdin: base64Stdin,
      },
      {
        headers: {
          'x-rapidapi-host': 'judge0-ce.p.rapidapi.com',
          'x-rapidapi-key': RAPIDAPI_KEY,
          'content-type': 'application/json',
        },
      }
    );

    const decode = (str) =>
      str ? Buffer.from(str, 'base64').toString('utf-8') : '';

    res.json({
      stdout: decode(response.data.stdout),
      stderr: decode(response.data.stderr),
      compile_output: decode(response.data.compile_output),
      message: decode(response.data.message),
      status: response.data.status,
    });
  } catch (err) {
    console.error("Error from Judge0:", err.response?.data || err.message);
    res.status(500).json({
      error: "Execution failed",
      details: err.response?.data || err.message,
    });
  }
});

// Start HTTP server
app.listen(HTTP_PORT, () => {
  console.log(`Judge0 API proxy running at http://localhost:${HTTP_PORT}`);
});

// ---------------------- WEBSOCKET SERVER ----------------------

// roomId -> Set of clients
const rooms = new Map();

// roomId -> { filePath: content }
const roomFiles = new Map();

const wss = new WebSocket.Server({ port: WS_PORT });

wss.on("connection", (ws) => {
  console.log("New client connected!");

  let currentRoom = null;

  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg.toString());
    } catch (e) {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      return;
    }

    // ---------------------- JOIN ROOM ----------------------
    if (data.type === "join") {
      currentRoom = data.roomId;
      if (!rooms.has(currentRoom)) rooms.set(currentRoom, new Set());
      rooms.get(currentRoom).add(ws);

      // Send existing files to new client
      if (roomFiles.has(currentRoom)) {
        ws.send(JSON.stringify({
          type: "init",
          files: roomFiles.get(currentRoom)
        }));
      } else {
        roomFiles.set(currentRoom, {}); // initialize room
      }

      console.log(`Client joined room: ${currentRoom}`);
      return;
    }

    if (!currentRoom) {
      ws.send(JSON.stringify({ type: "error", message: "Join a room first" }));
      return;
    }

    // --- FIX: ADDED HANDLER FOR PROJECT INITIALIZATION ---
    // ---------------------- PROJECT INIT ----------------------
    if (data.type === "init_project") {
      // Set the master files for the room
      roomFiles.set(currentRoom, data.files);

      // Broadcast this init state to all OTHER clients
      rooms.get(currentRoom).forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: "init", // Send the 'init' message
            files: data.files
          }));
        }
      });
      return;
    }

    // ---------------------- FILE EDIT ----------------------
    if (data.type === "edit") {
      const { path, content } = data;

      // Update room files (ensure files object exists)
      if (!roomFiles.has(currentRoom)) roomFiles.set(currentRoom, {});
      const files = roomFiles.get(currentRoom);
      files[path] = content;
      roomFiles.set(currentRoom, files);

      // Broadcast to other clients in the room
      rooms.get(currentRoom).forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: "edit",
            path,
            content
          }));
        }
      });
    }

    // ----------------------  CURSOR MOVEMENT ----------------------
    if (data.type === "cursor") {
      rooms.get(currentRoom).forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: "cursor",
            userId: data.userId,
            position: data.position
          }));
        }
      });
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(ws);
      if (rooms.get(currentRoom).size === 0) {
        rooms.delete(currentRoom);
        roomFiles.delete(currentRoom);
      }
    }
  });
});

console.log(`WebSocket server running on ws://localhost:${WS_PORT}`);
