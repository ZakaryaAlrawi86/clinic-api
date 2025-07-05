const multer = require('multer');

const storage = multer.memoryStorage(); // ✅ تخزين مؤقت في الذاكرة
const upload = multer({ storage });

module.exports = upload;
