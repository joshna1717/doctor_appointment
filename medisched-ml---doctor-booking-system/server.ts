import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import db from "./db.ts";
import { MLService, Doctor, PatientHistory } from "./src/services/mlService.ts";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/login", (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ? AND password = ?").get(email, password);
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.post("/api/register", (req, res) => {
    const { email, password, name, role, age } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO users (email, password, name, role, age) VALUES (?, ?, ?, ?, ?)");
      const result = stmt.run(email, password, name, role || 'patient', age || 30);
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
      res.json(user);
    } catch (err: any) {
      if (err.message.includes('UNIQUE constraint failed')) {
        res.status(400).json({ error: "Email already exists" });
      } else {
        res.status(500).json({ error: "Registration failed" });
      }
    }
  });

  app.get("/api/doctors", (req, res) => {
    const doctors = db.prepare(`
      SELECT d.*, u.name as name 
      FROM doctors d 
      JOIN users u ON d.userId = u.id
    `).all();
    res.json(doctors);
  });

  app.post("/api/recommend", async (req, res) => {
    const { symptoms } = req.body;
    const doctors = db.prepare(`
      SELECT d.*, u.name as name 
      FROM doctors d 
      JOIN users u ON d.userId = u.id
    `).all() as Doctor[];
    
    const recommended = await MLService.recommendDoctors(symptoms, doctors);
    res.json(recommended);
  });

  app.post("/api/appointments", (req, res) => {
    const { patientId, doctorId, date, time, symptoms } = req.body;
    
    // ML Feature 2: No-Show Prediction
    const patient = db.prepare("SELECT * FROM users WHERE id = ?").get(patientId) as any;
    const prevVisits = db.prepare("SELECT COUNT(*) as count FROM appointments WHERE patientId = ? AND status = 'completed'").get(patientId) as any;
    const prevCancelled = db.prepare("SELECT COUNT(*) as count FROM appointments WHERE patientId = ? AND status = 'cancelled'").get(patientId) as any;
    
    const history: PatientHistory = {
      age: patient.age || 30,
      previousVisits: prevVisits.count,
      cancelledBefore: prevCancelled.count,
      distanceKm: Math.random() * 20, // Simulated distance
      bookingDay: new Date(date).getDay(),
      bookingHour: parseInt(time.split(':')[0])
    };
    
    const noShowProb = MLService.predictNoShow(history);
    
    // ML Feature 3: Waiting Time Prediction
    const currentBookings = db.prepare("SELECT COUNT(*) as count FROM appointments WHERE doctorId = ? AND date = ? AND status = 'confirmed'").get(doctorId, date) as any;
    const waitingTime = MLService.predictWaitingTime(currentBookings.count, 20); // 20 mins avg duration

    const stmt = db.prepare(`
      INSERT INTO appointments (patientId, doctorId, date, time, symptoms, noShowProbability, predictedWaitingTime, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed')
    `);
    
    const result = stmt.run(patientId, doctorId, date, time, symptoms, noShowProb, waitingTime);
    res.json({ id: result.lastInsertRowid, noShowProbability: noShowProb, predictedWaitingTime: waitingTime });
  });

  app.get("/api/appointments/patient/:id", (req, res) => {
    const appointments = db.prepare(`
      SELECT a.*, u.name as doctorName, d.specialization 
      FROM appointments a 
      JOIN doctors d ON a.doctorId = d.id
      JOIN users u ON d.userId = u.id
      WHERE a.patientId = ?
      ORDER BY a.date DESC, a.time DESC
    `).all(req.params.id);
    res.json(appointments);
  });

  app.get("/api/appointments/doctor/:id", (req, res) => {
    const appointments = db.prepare(`
      SELECT a.*, u.name as patientName, u.age as patientAge
      FROM appointments a 
      JOIN users u ON a.patientId = u.id
      WHERE a.doctorId = ?
      ORDER BY a.date DESC, a.time DESC
    `).all(req.params.id);
    res.json(appointments);
  });

  app.get("/api/admin/analytics", (req, res) => {
    const totalBookings = db.prepare("SELECT COUNT(*) as count FROM appointments").get() as any;
    const completedBookings = db.prepare("SELECT COUNT(*) as count FROM appointments WHERE status = 'completed'").get() as any;
    const cancelledBookings = db.prepare("SELECT COUNT(*) as count FROM appointments WHERE status = 'cancelled'").get() as any;
    const popularSpecializations = db.prepare(`
      SELECT d.specialization, COUNT(*) as count 
      FROM appointments a 
      JOIN doctors d ON a.doctorId = d.id 
      GROUP BY d.specialization 
      ORDER BY count DESC
    `).all();
    
    res.json({
      total: totalBookings.count,
      completed: completedBookings.count,
      cancelled: cancelledBookings.count,
      popular: popularSpecializations
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
