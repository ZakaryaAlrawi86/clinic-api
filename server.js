const express = require('express');
const app = express();
require('dotenv').config(); // لتحميل .env

const patientRoutes = require('./routes/patients');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/patients', patientRoutes);

const PORT = process.env.PORT || 5000;
app.get("/", (req, res) => {
  res.send("API is working 🚀");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
