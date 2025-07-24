const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // مهم لتعمل على Railway
  },
});

async function createTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        age INTEGER,
        gender VARCHAR(10)
      );

      CREATE TABLE IF NOT EXISTS visits (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        visit_date DATE,
        reason TEXT
      );

      CREATE TABLE IF NOT EXISTS visit_images (
        id SERIAL PRIMARY KEY,
        visit_id INTEGER REFERENCES visits(id) ON DELETE CASCADE,
        image_url TEXT,
        public_id TEXT
      );
    `);

    console.log('✅ All tables created successfully');
  } catch (err) {
    console.error('❌ Error creating tables:', err);
  } finally {
    await pool.end();
  }
}

createTables();
