const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const client = require("prom-client");

const app = express();
app.use(express.json());
app.use(cors());

const port = 3000;

// Variables d'environnement
const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = process.env.DB_PORT || "5432";
const DB_NAME = process.env.DB_NAME || "helpdesk";
const DB_USER = process.env.DB_USER || "helpdesk";
const DB_PASSWORD = process.env.DB_PASSWORD || "password";

// Pool PostgreSQL
const pool = new Pool({
  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,
});

// ----- Prometheus metrics -----
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics();

const httpRequestCounter = new client.Counter({
  name: "http_requests_total",
  help: "Nombre total de requêtes HTTP",
  labelNames: ["method", "route", "status"]
});

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Durée des requêtes HTTP en secondes",
  labelNames: ["method", "route", "status"],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5]
});

const dbErrorsCounter = new client.Counter({
  name: "db_errors_total",
  help: "Nombre total d'erreurs de base de données"
});

// Middleware de mesure des requêtes
app.use((req, res, next) => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const diff = Number(process.hrtime.bigint() - start) / 1e9;
    const route = req.route && req.route.path ? req.route.path : req.path;
    const labels = {
      method: req.method,
      route: route,
      status: res.statusCode.toString()
    };

    httpRequestCounter.inc(labels);
    httpRequestDuration.observe(labels, diff);
  });

  next();
});

// ----- Initialisation BDD -----
async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'open',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Table tickets OK");
  } finally {
    client.release();
  }
}

// ----- Routes -----

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Liste des tickets
app.get("/api/tickets", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM tickets ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("Erreur /api/tickets", err);
    dbErrorsCounter.inc();
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Création d'un ticket
app.post("/api/tickets", async (req, res) => {
  const { title, description } = req.body;
  if (!title) {
    return res.status(400).json({ error: "title est obligatoire" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO tickets (title, description) VALUES ($1, $2) RETURNING *",
      [title, description || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Erreur POST /api/tickets", err);
    dbErrorsCounter.inc();
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Changer le statut d'un ticket
app.patch("/api/tickets/:id/status", async (req, res) => {
  const id = req.params.id;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: "status est obligatoire" });
  }

  try {
    const result = await pool.query(
      "UPDATE tickets SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Ticket non trouvé" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Erreur PATCH /api/tickets/:id/status", err);
    dbErrorsCounter.inc();
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Endpoint /metrics pour Prometheus
app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", client.register.contentType);
    res.end(await client.register.metrics());
  } catch (err) {
    console.error("Erreur /metrics", err);
    res.status(500).end();
  }
});

// Lancement
initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`Backend en écoute sur le port ${port}`);
      console.log(`DB: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}`);
    });
  })
  .catch((err) => {
    console.error("Erreur init DB", err);
    process.exit(1);
  });
