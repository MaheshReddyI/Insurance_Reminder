import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import multer from "multer";
import { parse } from "csv-parse";
import axios from "axios";
import { addDays, format, isSameDay, parseISO } from "date-fns";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();
const PORT = 3000;
const db = new Database("insurance.db");
const upload = multer({ dest: "uploads/" });

// Database Initialization
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT
  );

  CREATE TABLE IF NOT EXISTS policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    policy_number TEXT NOT NULL UNIQUE,
    policy_type TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS reminder_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    policy_id INTEGER,
    sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
    status TEXT,
    days_remaining INTEGER,
    message_type TEXT DEFAULT 'reminder',
    FOREIGN KEY (policy_id) REFERENCES policies(id)
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    message TEXT NOT NULL,
    sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
    total_recipients INTEGER,
    status TEXT
  );
`);

app.use(express.json());

// WhatsApp Reminder Logic
async function sendWhatsAppMessage(phone: string, messageData: { type: "template", name: string, params: string[] } | { type: "text", body: string }) {
  const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
  const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    const msg = messageData.type === "template" 
      ? `Template: ${messageData.name}, Params: ${messageData.params.join(", ")}`
      : `Text: ${messageData.body}`;
    console.log(`[MOCK WHATSAPP] To: ${phone}, Msg: ${msg}`);
    return { status: "mock_sent" };
  }

  try {
    const payload: any = {
      messaging_product: "whatsapp",
      to: phone,
    };

    if (messageData.type === "template") {
      payload.type = "template";
      payload.template = {
        name: messageData.name,
        language: { code: "en_US" },
        components: [
          {
            type: "body",
            parameters: messageData.params.map(p => ({ type: "text", text: p })),
          },
        ],
      };
    } else {
      payload.type = "text";
      payload.text = { body: messageData.body };
    }

    const response = await axios.post(
      `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
      }
    );
    return { status: "sent", data: response.data };
  } catch (error: any) {
    console.error("WhatsApp API Error:", error.response?.data || error.message);
    return { status: "failed", error: error.message };
  }
}

const apiRouter = express.Router();

// Health check
apiRouter.get("/health", (req, res) => {
  res.json({ status: "ok", env: process.env.NODE_ENV });
});

// API Routes logging
apiRouter.use((req, res, next) => {
  console.log(`API Request: ${req.method} ${req.url}`);
  next();
});

apiRouter.get("/stats", (req, res) => {
  try {
    const totalPolicies = db.prepare("SELECT COUNT(*) as count FROM policies").get() as { count: number };
    const expiringSoon = db.prepare(`
      SELECT COUNT(*) as count FROM policies 
      WHERE date(expiry_date) <= date('now', '+30 days') 
      AND date(expiry_date) >= date('now')
    `).get() as { count: number };
    
    const expiredCount = db.prepare(`
      SELECT COUNT(*) as count FROM policies 
      WHERE date(expiry_date) < date('now')
    `).get() as { count: number };
    
    const recentLogs = db.prepare(`
      SELECT l.*, p.policy_number, c.name as customer_name 
      FROM reminder_logs l
      JOIN policies p ON l.policy_id = p.id
      JOIN customers c ON p.customer_id = c.id
      ORDER BY l.sent_at DESC LIMIT 10
    `).all();

    res.json({
      totalPolicies: totalPolicies.count,
      expiringSoon: expiringSoon.count,
      expiredCount: expiredCount.count,
      recentLogs
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get("/policies", (req, res) => {
  try {
    const policies = db.prepare(`
      SELECT p.*, c.name as customer_name, c.phone 
      FROM policies p
      JOIN customers c ON p.customer_id = c.id
      ORDER BY p.expiry_date ASC
    `).all();
    res.json(policies);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post("/upload", upload.single("file"), async (req: any, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const parser = fs.createReadStream(req.file.path).pipe(parse({ 
      columns: true,
      skip_empty_lines: true,
      trim: true
    }));

    for await (const record of parser) {
      // Normalize keys to lowercase and remove spaces/underscores
      const normalizedRecord: any = {};
      Object.keys(record).forEach(key => {
        const normalizedKey = key.toLowerCase().replace(/[\s_]/g, "");
        normalizedRecord[normalizedKey] = record[key];
      });

      // Map common variations
      const name = normalizedRecord.name || normalizedRecord.customername || normalizedRecord.customer;
      let phone = normalizedRecord.phone || normalizedRecord.phonenumber || normalizedRecord.mobile || normalizedRecord.contact;
      const email = normalizedRecord.email || normalizedRecord.emailaddress || "";
      let policyNumber = normalizedRecord.policynumber || normalizedRecord.policyid || normalizedRecord.id || `AUTO-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const policyType = normalizedRecord.policytype || normalizedRecord.type || "General";
      let expiryDate = normalizedRecord.expirydate || normalizedRecord.expiry || normalizedRecord.duedate;

      if (!name || !phone || !expiryDate) {
        console.warn("Skipping record due to missing required fields:", record);
        continue;
      }

      // Handle scientific notation for phone numbers (e.g., 9.19877E+11)
      if (typeof phone === "string" && phone.includes("E+")) {
        phone = Number(phone).toString();
      }
      
      phone = String(phone).replace(/\D/g, "");
      if (phone.length === 10) phone = "91" + phone;
      if (!phone.startsWith("+")) phone = "+" + phone;

      // Normalize date format (attempt to handle DD-MM-YYYY or YYYY-MM-DD)
      if (expiryDate.includes("-") || expiryDate.includes("/")) {
        const parts = expiryDate.split(/[-/]/);
        if (parts[0].length === 2 && parts[2].length === 4) {
          // Assume DD-MM-YYYY
          expiryDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        } else if (parts[0].length === 4) {
          // Assume YYYY-MM-DD
          expiryDate = `${parts[0]}-${parts[1]}-${parts[2]}`;
        }
      }

      const customer = db.prepare("INSERT OR IGNORE INTO customers (name, phone, email) VALUES (?, ?, ?) RETURNING id").get(
        name, phone, email
      ) as { id: number } | undefined;

      let customerId: number;
      if (customer) {
        customerId = customer.id;
      } else {
        const existing = db.prepare("SELECT id FROM customers WHERE phone = ?").get(phone) as { id: number };
        if (existing) {
          customerId = existing.id;
        } else {
          continue; // Should not happen with INSERT OR IGNORE
        }
      }

      db.prepare("INSERT OR REPLACE INTO policies (customer_id, policy_number, policy_type, expiry_date) VALUES (?, ?, ?, ?)").run(
        customerId, policyNumber, policyType, expiryDate
      );
    }
    fs.unlinkSync(req.file.path);
    res.json({ message: "Upload successful" });
  } catch (err: any) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error("Upload error:", err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post("/customers", (req, res) => {
  const { name, phone, email, policy_number, policy_type, expiry_date } = req.body;
  
  let formattedPhone = phone.replace(/\D/g, "");
  if (formattedPhone.length === 10) formattedPhone = "91" + formattedPhone;
  if (!formattedPhone.startsWith("+")) formattedPhone = "+" + formattedPhone;

  try {
    const customer = db.prepare("INSERT OR IGNORE INTO customers (name, phone, email) VALUES (?, ?, ?) RETURNING id").get(
      name, formattedPhone, email
    ) as { id: number } | undefined;

    let customerId: number;
    if (customer) {
      customerId = customer.id;
    } else {
      const existing = db.prepare("SELECT id FROM customers WHERE phone = ?").get(formattedPhone) as { id: number };
      customerId = existing.id;
    }

    db.prepare("INSERT OR REPLACE INTO policies (customer_id, policy_number, policy_type, expiry_date) VALUES (?, ?, ?, ?)").run(
      customerId, policy_number, policy_type, expiry_date
    );
    res.json({ message: "Customer and policy added successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post("/broadcast", async (req, res) => {
  const { campaignName, messageTemplate, isTest } = req.body;
  
  try {
    let customers: any[] = [];
    if (isTest) {
      customers = [{ name: "Admin (Test)", phone: process.env.ADMIN_PHONE || "+919876543210" }];
    } else {
      customers = db.prepare("SELECT name, phone FROM customers").all() as any[];
    }

    const results = [];
    for (const customer of customers) {
      const personalizedMessage = messageTemplate.replace("{{1}}", customer.name);
      const outcome = await sendWhatsAppMessage(customer.phone, { type: "text", body: personalizedMessage });
      results.push({ phone: customer.phone, status: outcome.status });
    }

    if (!isTest) {
      db.prepare("INSERT INTO campaigns (name, message, total_recipients, status) VALUES (?, ?, ?, ?)").run(
        campaignName, messageTemplate, customers.length, "completed"
      );
    }

    res.json({ message: "Broadcast initiated", count: results.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post("/send-manual", async (req, res) => {
  const { phone, name, message } = req.body;
  const outcome = await sendWhatsAppMessage(phone, { type: "text", body: message });
  res.json({ status: outcome.status });
});

apiRouter.post("/trigger-reminders", async (req, res) => {
  const intervals = [30, 15, 7];
  const results = [];

  try {
    for (const days of intervals) {
      const targetDate = format(addDays(new Date(), days), "yyyy-MM-dd");
      const policies = db.prepare("SELECT p.*, c.name, c.phone FROM policies p JOIN customers c ON p.customer_id = c.id WHERE date(p.expiry_date) = ?").all(targetDate) as any[];

      for (const policy of policies) {
        const outcome = await sendWhatsAppMessage(policy.phone, { 
          type: "template", 
          name: "policy_expiry_reminder", 
          params: [policy.name, policy.policy_type, policy.expiry_date] 
        });
        db.prepare("INSERT INTO reminder_logs (policy_id, status, days_remaining) VALUES (?, ?, ?)").run(
          policy.id, outcome.status, days
        );
        results.push({ policy: policy.policy_number, days, status: outcome.status });
      }
    }
    res.json({ triggered: results.length, details: results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Catch-all for API routes
apiRouter.use((req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
});

app.use("/api", apiRouter);

// Vite Middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    if (fs.existsSync("dist")) {
      app.use(express.static("dist"));
      app.get("*", (req, res) => {
        res.sendFile(path.resolve("dist", "index.html"));
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

await startServer();
