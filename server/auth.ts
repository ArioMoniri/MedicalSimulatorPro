import passport from "passport";
import { IVerifyOptions, Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import nodemailer from "nodemailer";
import { users, insertUserSchema, passwordResetTokens, passwordResetRequestSchema, passwordResetSchema, type User as DbUser } from "@db/schema";
import { db } from "@db";
import { eq } from "drizzle-orm";

const scryptAsync = promisify(scrypt);
const crypto = {
  hash: async (password: string) => {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  },
  compare: async (suppliedPassword: string, storedPassword: string) => {
    const [hashedPassword, salt] = storedPassword.split(".");
    const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
    const suppliedPasswordBuf = (await scryptAsync(
      suppliedPassword,
      salt,
      64
    )) as Buffer;
    return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
  },
  generateToken: () => randomBytes(32).toString("hex"),
};

// Email configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const SESSION_DURATION = {
  STANDARD: 24 * 60 * 60 * 1000, // 24 hours
  EXTENDED: 30 * 24 * 60 * 60 * 1000, // 30 days
};

// Extend express User interface with our schema
// Exclude password from the User type for security
type SafeUser = Omit<DbUser, 'password'>;
declare global {
  namespace Express {
    interface User extends SafeUser {}
  }
}

export function setupAuth(app: Express) {
  const MemoryStore = createMemoryStore(session);
  const sessionSettings: session.SessionOptions = {
    secret: process.env.REPL_ID || "acisimu-2025",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: SESSION_DURATION.STANDARD,
      secure: false, // Set to false for development
    },
    store: new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    }),
  };

  // Remove production check for now to ensure cookies work
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        if (!user) {
          return done(null, false, { message: "Incorrect username." });
        }
        const isMatch = await crypto.compare(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: "Incorrect password." });
        }
        // Remove password before returning
        const { password: _, ...safeUser } = user;
        return done(null, safeUser);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Password reset request endpoint
  app.post("/api/reset-password/request", async (req, res) => {
    try {
      const result = passwordResetRequestSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).send("Invalid email address");
      }

      const { email } = result.data;

      // Find user by email
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        // Don't reveal if email exists
        return res.json({ message: "If your email is registered, you will receive a password reset link." });
      }

      // Generate reset token
      const token = crypto.generateToken();
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

      // Save token to database
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token,
        expiresAt,
      });

      // Send reset email
      const resetLink = `${req.protocol}://${req.get("host")}/reset-password/${token}`;
      await transporter.sendMail({
        from: process.env.SMTP_FROM || "noreply@acibadem.edu.tr",
        to: email,
        subject: "Password Reset Request - Acibadem Medical Simulation Platform",
        html: `
          <h1>Password Reset Request</h1>
          <p>A password reset was requested for your account. If you did not make this request, please ignore this email.</p>
          <p>To reset your password, click the link below (valid for 1 hour):</p>
          <a href="${resetLink}">${resetLink}</a>
        `,
      });

      res.json({ message: "If your email is registered, you will receive a password reset link." });
    } catch (error) {
      console.error("Password reset request error:", error);
      res.status(500).send("An error occurred while processing your request");
    }
  });

  // Reset password endpoint
  app.post("/api/reset-password/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const result = passwordResetSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).send(result.error.issues.map(i => i.message).join(", "));
      }

      const { password } = result.data;

      // Find valid token
      const [resetToken] = await db
        .select()
        .from(passwordResetTokens)
        .where(
          eq(passwordResetTokens.token, token)
        )
        .limit(1);

      if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
        return res.status(400).send("Invalid or expired reset token");
      }

      // Update password
      const hashedPassword = await crypto.hash(password);
      await db
        .update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, resetToken.userId));

      // Mark token as used
      await db
        .update(passwordResetTokens)
        .set({ used: true })
        .where(eq(passwordResetTokens.id, resetToken.id));

      res.json({ message: "Password successfully reset" });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).send("An error occurred while resetting your password");
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res
          .status(400)
          .send("Invalid input: " + result.error.issues.map(i => i.message).join(", "));
      }

      const { username, email, password } = result.data;

      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (existingUser) {
        return res.status(400).send("Username already exists");
      }

      // Hash the password
      const hashedPassword = await crypto.hash(password);

      // Create the new user
      const [newUser] = await db
        .insert(users)
        .values({
          username,
          email,
          password: hashedPassword,
        })
        .returning();

      // Remove password before sending response
      const { password: _, ...safeUser } = newUser;

      // Log the user in after registration
      req.login(safeUser, (err) => {
        if (err) {
          return next(err);
        }
        return res.json({
          message: "Registration successful",
          user: safeUser,
        });
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: Express.User | false, info: IVerifyOptions) => {
      if (err) {
        return next(err);
      }

      if (!user) {
        return res.status(400).send(info.message ?? "Login failed");
      }

      // Set session expiry based on rememberMe
      if (req.body.rememberMe) {
        if (req.session.cookie) {
          req.session.cookie.maxAge = SESSION_DURATION.EXTENDED;
        }
      }

      req.logIn(user, (err) => {
        if (err) {
          return next(err);
        }

        return res.json({
          message: "Login successful",
          user,
        });
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).send("Logout failed");
      }

      res.json({ message: "Logout successful" });
    });
  });

  app.get("/api/user", (req, res) => {
    if (req.isAuthenticated()) {
      return res.json(req.user);
    }
    res.status(401).send("Not logged in");
  });

  // Session timeout check middleware
  app.use((req, res, next) => {
    if (req.session && req.session.cookie) {
      const now = Date.now();
      const expires = req.session.cookie.expires?.getTime() || 0;

      // If session is about to expire in the next hour, extend it
      if (expires - now < 1000 * 60 * 60) {
        req.session.touch();
      }
    }
    next();
  });
}

// Adding WebSocket-specific authentication handling
export function authenticateWebSocket(id: number): Promise<Express.User | null> {
  return new Promise(async (resolve) => {
    try {
      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      resolve(user || null);
    } catch (err) {
      console.error("WebSocket auth error:", err);
      resolve(null);
    }
  });
}