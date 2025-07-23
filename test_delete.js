require('dotenv').config();
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

(async () => {
  try {
    const result = await cloudinary.uploader.destroy('clinic_images/zbcbmuydzy6rkofengmd');
    console.log('🔁 Deletion result:', result);
  } catch (err) {
    console.error('❌ Deletion error:', err);
  }
})();
