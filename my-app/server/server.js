const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

app.post('/run', async (req, res) => {
  // Destructure the request body.
  // The 'source_code' received from the frontend is already Base64 encoded.
  // The frontend sends 'base64_encoded: true' in its body, but we don't
  // need to explicitly use that flag here unless we wanted to conditionally
  // decode on the backend, which isn't necessary if Judge0 handles it.
  const { source_code, language_id, stdin = "" } = req.body;

  // The frontend is already sending Base64 encoded source_code.
  // Therefore, we should NOT re-encode it here.
  // We just need to ensure stdin is Base64 encoded if it's not already.
  const base64Stdin = Buffer.from(stdin).toString('base64');

  try {
    const response = await axios.post(
      'https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=true&wait=true', // Inform Judge0 that source_code is Base64
      {
        source_code: source_code, // Use the source_code directly as it's already Base64 from frontend
        language_id,
        stdin: base64Stdin, // Ensure stdin is Base64 encoded
      },
      {
        headers: {
          'x-rapidapi-host': 'judge0-ce.p.rapidapi.com',
          'x-rapidapi-key': 'fe9d4da002msh522e2019629f456p1b5ce4jsn1d09aef7f5a4', // Make sure this key is valid and secure
          'content-type': 'application/json',
        },
      }
    );

    // Judge0 sends back stdout, stderr, compile_output, etc. as Base64.
    // We need to decode them before sending to the frontend.
    const decode = (str) =>
      str ? Buffer.from(str, 'base64').toString('utf-8') : '';

    res.json({
      stdout: decode(response.data.stdout),
      stderr: decode(response.data.stderr),
      compile_output: decode(response.data.compile_output),
      message: decode(response.data.message),
      status: response.data.status, // Pass the full status object for more details
    });
  } catch (err) {
    console.error("Error from Judge0:", err.response?.data || err.message);
    // Provide more detailed error message from Judge0 if available
    res.status(500).json({ 
      error: "Execution failed",
      details: err.response?.data || err.message // Send back Judge0's error if present
    });
  }
});

app.listen(port, () => {
  console.log(`Judge0 API proxy running at http://localhost:${port}`);
});