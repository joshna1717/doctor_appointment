import Database from 'better-sqlite3';
import path from 'path';

const db = new Database('medisched.sqlite');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('patient', 'doctor', 'admin')),
    age INTEGER
  );

  CREATE TABLE IF NOT EXISTS doctors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    specialization TEXT NOT NULL,
    hospital TEXT NOT NULL,
    location TEXT NOT NULL,
    experience INTEGER NOT NULL,
    fees REAL NOT NULL,
    rating REAL DEFAULT 0,
    bio TEXT,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patientId INTEGER NOT NULL,
    doctorId INTEGER NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    symptoms TEXT,
    noShowProbability REAL,
    predictedWaitingTime INTEGER,
    FOREIGN KEY (patientId) REFERENCES users(id),
    FOREIGN KEY (doctorId) REFERENCES doctors(id)
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointmentId INTEGER NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT,
    FOREIGN KEY (appointmentId) REFERENCES appointments(id)
  );

  -- Seed some data if empty
  INSERT OR IGNORE INTO users (id, email, password, name, role, age) VALUES 
  (1, 'admin@medisched.com', 'admin123', 'System Admin', 'admin', 35),
  (2, 'dr.smith@medisched.com', 'doc123', 'Dr. John Smith', 'doctor', 45),
  (3, 'dr.jane@medisched.com', 'doc123', 'Dr. Jane Doe', 'doctor', 38),
  (4, 'patient@test.com', 'patient123', 'Alice Johnson', 'patient', 28);

  INSERT OR IGNORE INTO doctors (id, userId, specialization, hospital, location, experience, fees, rating, bio) VALUES 
  (1, 2, 'Cardiology', 'City Heart Center', 'Downtown', 15, 150, 4.8, 'Specialist in cardiovascular diseases.'),
  (2, 3, 'Pediatrics', 'Kids Care Clinic', 'Uptown', 10, 100, 4.9, 'Dedicated to child health and wellness.');
`);

export default db;
