// ---------------------- IMPORTS ----------------------
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const WebSocket = require('ws');

// ---------------------- EXPRESS APP ----------------------
const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

// ---------------------- JUDGE0 PROXY ----------------------
app.post('/run', async (req, res) => {
  const { source_code, language_id, stdin = "" } = req.body;

  // Encode stdin to Base64
  const base64Stdin = Buffer.from(stdin).toString('base64');

  try {
    const response = await axios.post(
      'https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=true&wait=true',
      {
        source_code,          // already base64 from frontend
        language_id,
        stdin: base64Stdin,
      },
      {
        headers: {
          'x-rapidapi-host': 'judge0-ce.p.rapidapi.com',
          'x-rapidapi-key': 'YOUR_RAPIDAPI_KEY_HERE', // ⚠️ replace with your key
          'content-type': 'application/json',
        },
      }
    );

    // Helper function to decode base64 outputs
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

// Start Express server
app.listen(port, () => {
  console.log(`Judge0 API proxy running at http://localhost:${port}`);
});

// ---------------------- WEBSOCKET SERVER ----------------------
const wss = new WebSocket.Server({ port: 8080 });

wss.on("connection", (ws) => {
  console.log("New client connected!");

  // Listen for messages from clients
  ws.on("message", (message) => {
    console.log("Received:", message.toString());

    // Broadcast to all other connected clients
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message.toString());
      }
    });
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

console.log("WebSocket server running on ws://localhost:8080");
