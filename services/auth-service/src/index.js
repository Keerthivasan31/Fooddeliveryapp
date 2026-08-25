require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");

const pool = require("./db/pool");

const app = express();
const PORT = Number(process.env.PORT || 4003);
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";

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

const uploadDirectory = path.join(__dirname, "..", "uploads");

fs.mkdirSync(uploadDirectory, {
  recursive: true,
});

const upload = multer({
  dest: uploadDirectory,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_request, file, callback) => {
    const allowed = /^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype);

    if (!allowed) {
      return callback(
        new Error("Only JPEG, PNG, WebP and GIF images are allowed"),
      );
    }

    return callback(null, true);
  },
});

const s3 = process.env.S3_BUCKET
  ? new S3Client({
      region: process.env.AWS_REGION || "ap-south-1",
    })
  : null;

function createObjectUrl(key) {
  const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;

  return `${baseUrl}/api/auth/uploads/${encodeURIComponent(key)}`;
}

app.use("/api/auth/uploads", express.static(uploadDirectory));

app.get("/api/auth/uploads/:key", async (request, response) => {
  if (!s3) {
    return response.status(404).json({
      error: "Object storage is not configured",
    });
  }

  try {
    const output = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: request.params.key,
      }),
    );

    response.setHeader(
      "Content-Type",
      output.ContentType || "application/octet-stream",
    );

    if (!output.Body) {
      return response.status(404).end();
    }

    return output.Body.pipe(response);
  } catch (error) {
    console.error("Unable to retrieve image:", error);

    if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
      return response.status(404).json({
        error: "Image not found",
      });
    }

    return response.status(500).json({
      error: "Unable to load image",
    });
  }
});

function requireUser(request, response, next) {
  const token = String(request.headers.authorization || "").replace(
    /^Bearer\s+/i,
    "",
  );

  if (!token) {
    return response.status(401).json({
      error: "Authorization token required",
    });
  }

  try {
    request.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (_error) {
    return response.status(401).json({
      error: "Invalid or expired token",
    });
  }
}

app.get("/health", (_request, response) => {
  response.status(200).json({
    status: "ok",
    service: "auth-service",
    timestamp: new Date().toISOString(),
  });
});

const allowedRoles = new Set(["CUSTOMER", "RESTAURANT", "DELIVERY", "ADMIN"]);

app.post("/api/auth/register", async (request, response) => {
  const {
    name,
    email,
    password,
    role = "CUSTOMER",
    mobile = "",
  } = request.body;

  if (!name || !email || !password) {
    return response.status(400).json({
      error: "name, email and password are required",
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedRole = String(role).trim().toUpperCase();

  if (!allowedRoles.has(normalizedRole)) {
    return response.status(400).json({
      error: "Invalid role",
    });
  }

  if (normalizedRole === "ADMIN") {
    return response.status(403).json({
      error: "Admin accounts must be provisioned by an administrator",
    });
  }

  if (String(password).length < 6) {
    return response.status(400).json({
      error: "Password must be at least 6 characters",
    });
  }

  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [
      normalizedEmail,
    ]);

    if (existing.rowCount) {
      return response.status(409).json({
        error: "Email is already registered",
      });
    }

    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);

    await pool.query(
      `INSERT INTO users
       (id, name, email, password_hash, role, mobile)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        String(name).trim(),
        normalizedEmail,
        passwordHash,
        normalizedRole,
        String(mobile || "").trim(),
      ],
    );

    return response.status(201).json({
      message: "Registration successful. Please login.",
    });
  } catch (error) {
    console.error("Registration failed:", error);

    return response.status(500).json({
      error: "Unable to register user",
    });
  }
});

app.post("/api/auth/login", async (request, response) => {
  const { email, password } = request.body;

  if (!email || !password) {
    return response.status(400).json({
      error: "email and password are required",
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, email, password_hash, role
       FROM users
       WHERE email = $1`,
      [String(email).trim().toLowerCase()],
    );

    if (!result.rowCount) {
      return response.status(401).json({
        error: "Invalid email or password",
      });
    }

    const user = result.rows[0];
    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      return response.status(401).json({
        error: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        sub: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      {
        expiresIn: "2h",
      },
    );

    return response.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login failed:", error);

    return response.status(500).json({
      error: "Unable to login",
    });
  }
});

app.get("/api/users/me", requireUser, async (request, response) => {
  try {
    const result = await pool.query(
      `SELECT
         id,
         name,
         email,
         role,
         mobile,
         profile_photo,
         addresses,
         created_at
       FROM users
       WHERE id = $1`,
      [request.user.sub],
    );

    if (!result.rowCount) {
      return response.status(404).json({
        error: "User not found",
      });
    }

    return response.json(result.rows[0]);
  } catch (error) {
    console.error("Unable to load profile:", error);

    return response.status(500).json({
      error: "Unable to load profile",
    });
  }
});

app.patch("/api/users/me", requireUser, async (request, response) => {
  const { name, email, mobile, addresses } = request.body;

  if (addresses !== undefined && !Array.isArray(addresses)) {
    return response.status(400).json({
      error: "addresses must be an array",
    });
  }

  try {
    const normalizedEmail =
      email !== undefined ? String(email).trim().toLowerCase() : null;

    const serializedAddresses =
      addresses !== undefined ? JSON.stringify(addresses) : null;

    const result = await pool.query(
      `UPDATE users
       SET
         name = COALESCE($1, name),
         email = COALESCE($2, email),
         mobile = COALESCE($3, mobile),
         addresses = COALESCE($4::jsonb, addresses)
       WHERE id = $5
       RETURNING
         id,
         name,
         email,
         role,
         mobile,
         profile_photo,
         addresses,
         created_at`,
      [
        name ?? null,
        normalizedEmail,
        mobile ?? null,
        serializedAddresses,
        request.user.sub,
      ],
    );

    if (!result.rowCount) {
      return response.status(404).json({
        error: "User not found",
      });
    }

    return response.json(result.rows[0]);
  } catch (error) {
    console.error("Unable to update profile:", error);

    if (error.code === "23505") {
      return response.status(409).json({
        error: "Email is already registered",
      });
    }

    return response.status(500).json({
      error: "Unable to update profile",
    });
  }
});

app.post("/api/users/me/password", requireUser, async (request, response) => {
  const { currentPassword, newPassword } = request.body;

  if (!currentPassword || !newPassword || String(newPassword).length < 6) {
    return response.status(400).json({
      error:
        "Current password and a new password of at least 6 characters are required",
    });
  }

  try {
    const result = await pool.query(
      "SELECT password_hash FROM users WHERE id = $1",
      [request.user.sub],
    );

    if (!result.rowCount) {
      return response.status(404).json({
        error: "User not found",
      });
    }

    const passwordValid = await bcrypt.compare(
      currentPassword,
      result.rows[0].password_hash,
    );

    if (!passwordValid) {
      return response.status(401).json({
        error: "Current password is incorrect",
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      passwordHash,
      request.user.sub,
    ]);

    return response.json({
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Unable to change password:", error);

    return response.status(500).json({
      error: "Unable to change password",
    });
  }
});

app.post(
  "/api/users/me/photo",
  requireUser,
  upload.single("image"),
  async (request, response) => {
    if (!request.file) {
      return response.status(400).json({
        error: "Image file is required",
      });
    }

    try {
      const extension =
        path.extname(request.file.originalname).toLowerCase() || ".jpg";

      const key =
        `profiles-${request.user.sub}-${Date.now()}-` +
        `${crypto.randomUUID()}${extension}`;

      let imageUrl;

      if (s3) {
        await s3.send(
          new PutObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: key,
            Body: fs.createReadStream(request.file.path),
            ContentType: request.file.mimetype,
          }),
        );

        fs.unlinkSync(request.file.path);
        imageUrl = createObjectUrl(key);
      } else {
        imageUrl = `${
          process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`
        }/api/auth/uploads/${request.file.filename}`;
      }

      const result = await pool.query(
        `UPDATE users
         SET profile_photo = $1
         WHERE id = $2
         RETURNING profile_photo`,
        [imageUrl, request.user.sub],
      );

      return response.json(result.rows[0]);
    } catch (error) {
      console.error("Unable to save profile photo:", error);

      if (request.file?.path && fs.existsSync(request.file.path)) {
        fs.unlinkSync(request.file.path);
      }

      return response.status(500).json({
        error: "Unable to save profile photo",
      });
    }
  },
);

const initSql = fs.readFileSync(path.join(__dirname, "db", "init.sql"), "utf8");

async function provisionAdmin() {
  const email = String(process.env.ADMIN_EMAIL || "admin@fooddelivery.local")
    .trim()
    .toLowerCase();

  const password = String(process.env.ADMIN_PASSWORD || "Admin@12345");

  const name = String(process.env.ADMIN_NAME || "Platform Admin");

  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [
    email,
  ]);

  if (existing.rowCount) {
    await pool.query(
      `UPDATE users
       SET
         name = $1,
         password_hash = $2,
         role = 'ADMIN'
       WHERE email = $3`,
      [name, passwordHash, email],
    );
  } else {
    await pool.query(
      `INSERT INTO users
       (id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'ADMIN')`,
      [crypto.randomUUID(), name, email, passwordHash],
    );
  }
}

async function startServer() {
  await pool.query(initSql);
  await provisionAdmin();

  app.listen(PORT, () => {
    console.log(`Auth service listening on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Auth service startup failed:", error);
  process.exit(1);
});

module.exports = app;
