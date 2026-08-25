require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const ordersRouter = require("./routes/orders");
const errorHandler = require("./middleware/errorHandler");
const logger = require("./utils/logger");
const pool = require("./db/pool");

const app = express();
const PORT = Number(process.env.PORT || 4000);

const allowedOrigins = String(process.env.CORS_ORIGINS || "*")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (
      !origin ||
      allowedOrigins.includes("*") ||
      allowedOrigins.includes(origin)
    ) {
      return callback(null, true);
    }

    return callback(new Error("Origin not allowed by CORS"));
  },
};

app.use(cors(corsOptions));
app.use(express.json());

app.use((error, request, response, next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    logger.error("JSON parsing error", {
      error: error.message,
      contentType: request.get("content-type"),
      method: request.method,
      url: request.originalUrl,
    });

    return response.status(400).json({
      error: "Invalid JSON in request body",
      details: error.message,
    });
  }

  return next(error);
});

app.get("/health", (_request, response) => {
  response.status(200).json({
    status: "ok",
    service: "order-service",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/orders", ordersRouter);
app.use(errorHandler);

const initSql = fs.readFileSync(path.join(__dirname, "db", "init.sql"), "utf8");

async function startServer() {
  await pool.query(initSql);

  app.listen(PORT, () => {
    logger.info(`Order service listening on port ${PORT}`);
  });
}

startServer().catch((error) => {
  logger.error("Order service database initialization failed", {
    error: error.message,
    stack: error.stack,
  });

  process.exit(1);
});

module.exports = app;
