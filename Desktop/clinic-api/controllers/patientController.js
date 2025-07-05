require('dotenv').config();

const pool = require('../db');
const streamifier = require('streamifier');
const cloudinary = require('../config/cloudinary');

// إنشاء مريض
exports.addPatient = async (req, res) => {
  try {
    const { name, age, gender } = req.body;
    const result = await pool.query(
      'INSERT INTO patients (name, age, gender) VALUES ($1, $2, $3) RETURNING *',
      [name, age, gender]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create patient' });
  }
};

// تعديل مريض
exports.updatePatient = async (req, res) => {
  const { id } = req.params;
  const { name, age, gender } = req.body;
  try {
    const result = await pool.query(
      'UPDATE patients SET name = $1, age = $2, gender = $3 WHERE id = $4 RETURNING *',
      [name, age, gender, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update patient' });
  }
};

// حذف مريض مع حذف صوره من Cloudinary
exports.deletePatient = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const imagesResult = await client.query(`
      SELECT vi.public_id
      FROM visit_images vi
      JOIN visits v ON vi.visit_id = v.id
      WHERE v.patient_id = $1
    `, [id]);

    for (let row of imagesResult.rows) {
      const publicId = row.public_id;
      if (publicId) {
        await cloudinary.uploader.destroy(publicId);
      }
    }

    await client.query('DELETE FROM patients WHERE id = $1', [id]);
    await client.query('COMMIT');

    res.json({ message: 'Patient and all related data deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error deleting patient and files:', err);
    res.status(500).json({ error: 'Failed to delete patient and related data' });
  } finally {
    client.release();
  }
};

// البحث عن مريض
exports.searchPatients = async (req, res) => {
  try {
    const searchTerm = req.query.name || '';
    const result = await pool.query(
      'SELECT * FROM patients WHERE name ILIKE $1 ORDER BY name ASC',
      [`%${searchTerm}%`]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed' });
  }
};

// عرض زيارات المريض
exports.getPatientVisits = async (req, res) => {
  try {
    const patientId = req.params.id;

    const patientResult = await pool.query('SELECT * FROM patients WHERE id = $1', [patientId]);
    if (patientResult.rowCount === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const visitsResult = await pool.query(
      'SELECT * FROM visits WHERE patient_id = $1 ORDER BY visit_date DESC',
      [patientId]
    );

    const visits = await Promise.all(visitsResult.rows.map(async (visit) => {
      const images = await pool.query(
        'SELECT id, image_url, public_id FROM visit_images WHERE visit_id = $1',
        [visit.id]
      );
      return {
        ...visit,
        images: images.rows
      };
    }));

    res.json({
      patient: patientResult.rows[0],
      visits
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve visits' });
  }
};

// إضافة زيارة مع رفع الصور إلى Cloudinary
exports.addVisit = async (req, res) => {
  const client = await pool.connect();
  try {
    const { reason, visit_date } = req.body;
    const patientId = req.params.id;

    await client.query('BEGIN');

    const visitResult = await client.query(
      'INSERT INTO visits (patient_id, visit_date, reason) VALUES ($1, $2, $3) RETURNING *',
      [patientId, visit_date, reason]
    );

    const visitId = visitResult.rows[0].id;

    if (req.files && req.files.length > 0) {
      for (let file of req.files) {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: 'clinic_images',
              use_filename: false,
              unique_filename: true
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          streamifier.createReadStream(file.buffer).pipe(stream);
        });

        await client.query(
          'INSERT INTO visit_images (visit_id, image_url, public_id) VALUES ($1, $2, $3)',
          [visitId, result.secure_url, result.public_id]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Visit added successfully', visit: visitResult.rows[0] });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error adding visit:', err);
    res.status(500).json({ error: 'Failed to add visit' });
  } finally {
    client.release();
  }
};

// تعديل زيارة
exports.updateVisit = async (req, res) => {
  const { visitId } = req.params;
  const { visit_date, reason } = req.body;
  try {
    const result = await pool.query(
      'UPDATE visits SET visit_date = $1, reason = $2 WHERE id = $3 RETURNING *',
      [visit_date, reason, visitId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update visit' });
  }
};

// حذف زيارة
exports.deleteVisit = async (req, res) => {
  const { visitId } = req.params;
  try {
    await pool.query('DELETE FROM visits WHERE id = $1', [visitId]);
    res.json({ message: 'Visit deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete visit' });
  }
};
// حذف صورة من Cloudinary
exports.deleteVisitImage = async (req, res) => {
  const { imageId } = req.params;
  console.log("📥 Request to delete imageId:", imageId);

  try {
    const imageResult = await pool.query(
      'SELECT public_id FROM visit_images WHERE id = $1',
      [imageId]
    );

    if (imageResult.rowCount === 0) {
      console.warn('⚠️ Image not found in DB with id:', imageId);
      return res.status(404).json({ error: 'Image not found' });
    }

    const publicId = imageResult.rows[0].public_id;
    console.log("🔍 Found public_id:", publicId);

    if (publicId) {
      const cloudResult = await cloudinary.uploader.destroy(publicId);
      console.log("🗑️ Cloudinary delete result:", cloudResult);
    }

    const deleteResult = await pool.query(
      'DELETE FROM visit_images WHERE id = $1 RETURNING *',
      [imageId]
    );

    console.log("📦 DB delete result:", deleteResult.rows);

    if (deleteResult.rowCount === 0) {
      console.warn('⚠️ Image not deleted from DB');
      return res.status(500).json({ error: 'Image deletion from DB failed' });
    }

    res.json({ message: 'Image deleted successfully' });

  } catch (err) {
    console.error('❌ Failed to delete image:', err);
    res.status(500).json({ error: 'Failed to delete image' });
  }
};

// تعديل صورة
exports.updateVisitImage = async (req, res) => {
  const { imageId } = req.params;

  try {
    if (!req.file || !req.file.buffer) {
      console.error('❌ لم يتم استلام ملف صورة');
      return res.status(400).json({ error: 'لم يتم إرسال صورة جديدة' });
    }

    const oldImage = await pool.query(
      'SELECT public_id FROM visit_images WHERE id = $1',
      [imageId]
    );

    if (oldImage.rowCount === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const oldPublicId = oldImage.rows[0].public_id;
    if (oldPublicId) {
      await cloudinary.uploader.destroy(oldPublicId);
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'clinic_images',
          use_filename: false,
          unique_filename: true,
        },
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary error:', error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      streamifier.createReadStream(req.file.buffer).pipe(stream);
    });

    await pool.query(
      'UPDATE visit_images SET image_url = $1, public_id = $2 WHERE id = $3',
      [result.secure_url, result.public_id, imageId]
    );

    res.json({ message: 'Image updated successfully', image_url: result.secure_url });

  } catch (err) {
    console.error('❌ Error in updateVisitImage:', err);
    res.status(500).json({ error: 'Failed to update image' });
  }
};

// إضافة صورة جديدة إلى زيارة
exports.addImageToVisit = async (req, res) => {
  const visitId = req.params.visitId;

  if (!req.file) return res.status(400).json({ message: 'لم يتم اختيار صورة' });

  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'clinic_images' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      stream.end(req.file.buffer);
    });

    const imageUrl = result.secure_url;
    const publicId = result.public_id;

    await pool.query(
      'INSERT INTO visit_images (visit_id, image_url, public_id) VALUES ($1, $2, $3)',
      [visitId, imageUrl, publicId]
    );

    res.json({ message: 'تمت إضافة الصورة', image_url: imageUrl });
  } catch (error) {
    console.error('خطأ في رفع الصورة:', error);
    res.status(500).json({ message: 'فشل في رفع الصورة' });
  }
};
