const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

app.post('/run', async (req, res) => {

  const { source_code, language_id, stdin = "" } = req.body;

  const base64Stdin = Buffer.from(stdin).toString('base64');

  try {
    const response = await axios.post(
      'https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=true&wait=true',      {
        source_code: source_code,
        language_id,
        stdin: base64Stdin, },
      {
        headers: {
          'x-rapidapi-host': 'judge0-ce.p.rapidapi.com',
          'x-rapidapi-key': 'fe9d4da002msh522e2019629f456p1b5ce4jsn1d09aef7f5a4',                   'content-type': 'application/json',
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
      details: err.response?.data || err.message 
    });
  }
});

app.listen(port, () => {
  console.log(`Judge0 API proxy running at http://localhost:${port}`);
});
