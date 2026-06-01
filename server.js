import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const UPLOAD_DIR = path.join(__dirname, "uploads");
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || "0.0.0.0";
const ADMIN_USERNAME = process.env.ATS_ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ATS_ADMIN_PASS || "ats2026";
const ADMIN_TOKEN = process.env.ATS_ADMIN_TOKEN || "ats-admin-local-token";

const defaultHomepage = {
  heroEyebrow: "Season 1 registrations open",
  heroTitle: "ATS 2026",
  heroSubtitle: "Artist Talent Show",
  heroDescription: "A premium national talent-show platform for performers, creators, models, singers, and dancers ready for a real stage, public voting, brand attention, and recognition.",
  contactEmail: "hello@ats2026.com",
  contactPhone: "+91 90000 00000",
  contactLocation: "India-wide talent events",
  socialInstagram: "https://instagram.com/",
  socialYoutube: "https://youtube.com/",
  socialFacebook: "https://facebook.com/",
  socialTelegram: "https://t.me/",
  socialLinkedin: "https://linkedin.com/"
};

const defaultCategories = [
  { id: "category-dancer", name: "Dancer", active: true },
  { id: "category-singer", name: "Singer", active: true },
  { id: "category-model", name: "Model", active: true },
  { id: "category-influencer", name: "Influencer", active: true },
  { id: "category-performer", name: "Public Performer", active: true }
];

const defaultSponsors = [
  { id: "sponsor-mediaone", name: "MediaOne", url: "", active: true },
  { id: "sponsor-stagepro", name: "StagePro", url: "", active: true },
  { id: "sponsor-creatorlab", name: "CreatorLab", url: "", active: true }
];

const defaultTestimonials = [
  { id: "testimonial-riya", quote: "ATS gave our performers a serious stage and a real audience.", name: "Riya Sharma", role: "Creative Director", active: true },
  { id: "testimonial-arjun", quote: "The event flow, voting experience, and media coverage felt premium.", name: "Arjun Malhotra", role: "Sponsor Partner", active: true },
  { id: "testimonial-mehak", quote: "A strong platform for discovering fresh talent across cities.", name: "Mehak Sinha", role: "Talent Mentor", active: true }
];

function emptyDb() {
  return {
    participants: [],
    sports: [],
    events: [],
    eventBookings: [],
    leads: [],
    brochure: {},
    brochures: [],
    sponsors: defaultSponsors,
    testimonials: defaultTestimonials,
    categories: defaultCategories,
    homepage: defaultHomepage
  };
}

const defaultPdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 105 >>
stream
BT
/F1 24 Tf
72 700 Td
(ATS 2026 Artist Talent Show) Tj
0 -38 Td
/F1 14 Tf
(Upload the final brochure from the admin dashboard.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000241 00000 n 
0000000397 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
467
%%EOF`;

async function ensureFiles() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(UPLOAD_DIR, { recursive: true });
  if (!existsSync(DB_FILE)) {
    await writeFile(DB_FILE, JSON.stringify(emptyDb(), null, 2));
  }
  const pdfPath = path.join(__dirname, "uploads", "ats-2026-brochure.pdf");
  if (!existsSync(pdfPath)) {
    await writeFile(pdfPath, defaultPdf);
  }
}

async function readDb() {
  await ensureFiles();
  const db = JSON.parse(await readFile(DB_FILE, "utf8"));
  db.participants ||= [];
  db.sports ||= [];
  db.events ||= [];
  db.eventBookings ||= [];
  db.leads ||= [];
  db.sponsors ||= defaultSponsors;
  db.testimonials ||= defaultTestimonials;
  db.categories ||= defaultCategories;
  db.homepage ||= defaultHomepage;
  db.brochure ||= {};
  db.brochures ||= db.brochure?.path
    ? [{
        id: "b-001",
        title: "ATS 2026 Main Brochure",
        fileName: db.brochure.fileName,
        path: db.brochure.path,
        active: true,
        updatedAt: db.brochure.updatedAt || new Date().toISOString()
      }]
    : [];
  if (!db.brochure?.path && !db.brochures.length) {
    const preferredPdf = existsSync(path.join(UPLOAD_DIR, "ats_2026.pdf")) ? "ats_2026.pdf" : "ats-2026-brochure.pdf";
    db.brochure = {
      fileName: preferredPdf,
      path: `uploads/${preferredPdf}`,
      updatedAt: new Date().toISOString()
    };
    db.brochures = [{
      id: "brochure-default",
      title: "ATS 2026 Main Brochure",
      fileName: preferredPdf,
      path: `uploads/${preferredPdf}`,
      active: true,
      updatedAt: db.brochure.updatedAt
    }];
    await writeDb(db);
  }
  return db;
}

async function writeDb(db) {
  await writeFile(DB_FILE, JSON.stringify(db, null, 2));
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  });
  res.end(JSON.stringify(data));
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

function isAdmin(req) {
  return req.headers.authorization === `Bearer ${ADMIN_TOKEN}`;
}

function requireAdmin(req, res) {
  if (isAdmin(req)) return true;
  sendError(res, 401, "Admin login required");
  return false;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Invalid request data");
  }
}

function publicDb(db) {
  const brochures = activeBrochures(db);
  return {
    participants: db.participants.filter((participant) => participant.active),
    sports: db.sports.filter((sport) => sport.active),
    events: db.events.filter((event) => event.active),
    brochure: db.brochure,
    brochures: brochures.map(publicBrochure),
    sponsors: db.sponsors.filter((sponsor) => sponsor.active),
    testimonials: db.testimonials.filter((testimonial) => testimonial.active),
    categories: db.categories.filter((category) => category.active),
    homepage: db.homepage
  };
}

function brochureFileExists(brochure) {
  if (!brochure?.path) return false;
  return existsSync(path.join(__dirname, brochure.path));
}

function activeBrochures(db) {
  return db.brochures.filter((brochure) => brochure.active && brochureFileExists(brochure));
}

function publicBrochure(brochure) {
  return {
    id: brochure.id,
    title: brochure.title,
    fileName: brochure.fileName,
    url: `/${brochure.path}`
  };
}

function adminDb(db) {
  return {
    ...db,
    brochures: db.brochures.map((brochure) => ({ ...brochure, fileAvailable: brochureFileExists(brochure) }))
  };
}

async function saveBrochureFile(payload) {
  if (!payload.dataUrl || !payload.fileName) throw new Error("PDF file is required");
  if (!payload.dataUrl.startsWith("data:application/pdf")) throw new Error("Only PDF brochure files are allowed");
  const base64 = payload.dataUrl.split(",").pop();
  if (!base64) throw new Error("PDF file data is missing");
  const safeName = payload.fileName.replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
  if (!safeName.endsWith(".pdf")) throw new Error("Brochure file must end with .pdf");
  const filePath = path.join(UPLOAD_DIR, safeName);
  await writeFile(filePath, Buffer.from(base64, "base64"));
  return {
    fileName: safeName,
    path: `uploads/${safeName}`
  };
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

async function handleCollection(req, res, db, collection, prefix, pathname) {
  const id = pathname.split("/").pop();

  if (req.method === "POST") {
    const item = await readBody(req);
    const nextItem = { ...item, id: makeId(prefix) };
    db[collection].push(nextItem);
    await writeDb(db);
    return sendJson(res, 201, nextItem);
  }

  if (req.method === "PUT") {
    const item = await readBody(req);
    const index = db[collection].findIndex((entry) => entry.id === id);
    if (index === -1) return sendError(res, 404, "Item not found");
    db[collection][index] = { ...db[collection][index], ...item, id };
    await writeDb(db);
    return sendJson(res, 200, db[collection][index]);
  }

  if (req.method === "DELETE") {
    db[collection] = db[collection].filter((entry) => entry.id !== id);
    await writeDb(db);
    return sendJson(res, 200, { ok: true });
  }

  return sendError(res, 405, "Method not allowed");
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") return sendJson(res, 200, { ok: true });

  try {
    await ensureFiles();

    if (url.pathname.startsWith("/uploads/")) {
      const safeName = path.basename(url.pathname);
      const filePath = path.join(UPLOAD_DIR, safeName);
      if (!existsSync(filePath)) {
        res.writeHead(404);
        return res.end("File not found");
      }
      const file = await readFile(filePath);
      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Access-Control-Allow-Origin": "*"
      });
      return res.end(file);
    }

    const db = await readDb();

    if (url.pathname === "/api/login" && req.method === "POST") {
      const credentials = await readBody(req);
      if (credentials.username === ADMIN_USERNAME && credentials.password === ADMIN_PASSWORD) {
        return sendJson(res, 200, { token: ADMIN_TOKEN, username: ADMIN_USERNAME });
      }
      return sendError(res, 401, "Invalid username or password");
    }

    if (req.method === "GET" && url.pathname === "/api/public") {
      return sendJson(res, 200, publicDb(db));
    }

    if (req.method === "GET" && url.pathname === "/api/admin") {
      if (!requireAdmin(req, res)) return;
      return sendJson(res, 200, adminDb(db));
    }

    if (url.pathname === "/api/leads" && req.method === "GET") {
      if (!requireAdmin(req, res)) return;
      return sendJson(res, 200, db.leads);
    }

    if (url.pathname === "/api/leads/bulk-delete" && req.method === "POST") {
      if (!requireAdmin(req, res)) return;
      const payload = await readBody(req);
      const ids = Array.isArray(payload.ids) ? payload.ids : [];
      if (!ids.length) return sendError(res, 400, "Select at least one lead to delete");
      const before = db.leads.length;
      const idSet = new Set(ids);
      db.leads = db.leads.filter((lead) => !idSet.has(lead.id));
      await writeDb(db);
      return sendJson(res, 200, { ok: true, deleted: before - db.leads.length });
    }

    if (url.pathname.startsWith("/api/leads/") && req.method === "DELETE") {
      if (!requireAdmin(req, res)) return;
      const id = url.pathname.split("/").pop();
      const before = db.leads.length;
      db.leads = db.leads.filter((lead) => lead.id !== id);
      if (db.leads.length === before) return sendError(res, 404, "Lead not found");
      await writeDb(db);
      return sendJson(res, 200, { ok: true, deleted: 1 });
    }

    if (url.pathname === "/api/leads" && req.method === "POST") {
      const lead = await readBody(req);
      const nextLead = {
        ...lead,
        id: makeId("lead"),
        createdAt: new Date().toISOString()
      };
      db.leads.unshift(nextLead);
      await writeDb(db);
      const brochures = activeBrochures(db);
      return sendJson(res, 201, {
        lead: nextLead,
        brochures: brochures.map(publicBrochure)
      });
    }

    if (url.pathname === "/api/event-bookings" && req.method === "GET") {
      if (!requireAdmin(req, res)) return;
      return sendJson(res, 200, db.eventBookings);
    }

    if (url.pathname === "/api/event-bookings" && req.method === "POST") {
      const booking = await readBody(req);
      const nextBooking = {
        ...booking,
        id: makeId("booking"),
        status: "New",
        createdAt: new Date().toISOString()
      };
      db.eventBookings.unshift(nextBooking);
      await writeDb(db);
      return sendJson(res, 201, nextBooking);
    }

    if (url.pathname === "/api/brochure" && req.method === "PUT") {
      if (!requireAdmin(req, res)) return;
      const payload = await readBody(req);
      const savedFile = await saveBrochureFile(payload);
      db.brochure = {
        ...savedFile,
        updatedAt: new Date().toISOString()
      };
      const firstBrochure = db.brochures[0];
      if (firstBrochure) {
        db.brochures[0] = {
          ...firstBrochure,
          title: firstBrochure.title || "ATS 2026 Main Brochure",
          ...savedFile,
          active: true,
          updatedAt: db.brochure.updatedAt
        };
      } else {
        db.brochures.push({
          id: makeId("brochure"),
          title: "ATS 2026 Main Brochure",
          ...savedFile,
          active: true,
          updatedAt: db.brochure.updatedAt
        });
      }
      await writeDb(db);
      return sendJson(res, 200, db.brochure);
    }

    if (url.pathname === "/api/brochures" && req.method === "GET") {
      if (!requireAdmin(req, res)) return;
      return sendJson(res, 200, db.brochures.map((brochure) => ({ ...brochure, fileAvailable: brochureFileExists(brochure) })));
    }

    if (url.pathname === "/api/brochures" && req.method === "POST") {
      if (!requireAdmin(req, res)) return;
      const payload = await readBody(req);
      const savedFile = await saveBrochureFile(payload);
      const brochure = {
        id: makeId("brochure"),
        title: payload.title || payload.fileName,
        ...savedFile,
        active: payload.active !== false,
        updatedAt: new Date().toISOString()
      };
      db.brochures.unshift(brochure);
      if (brochure.active || !db.brochure?.path) db.brochure = { fileName: brochure.fileName, path: brochure.path, updatedAt: brochure.updatedAt };
      await writeDb(db);
      return sendJson(res, 201, brochure);
    }

    if (url.pathname.startsWith("/api/brochures/") && req.method === "PUT") {
      if (!requireAdmin(req, res)) return;
      const id = url.pathname.split("/").pop();
      const payload = await readBody(req);
      const index = db.brochures.findIndex((brochure) => brochure.id === id);
      if (index === -1) return sendError(res, 404, "Brochure not found");
      const savedFile = payload.dataUrl ? await saveBrochureFile(payload) : {};
      db.brochures[index] = {
        ...db.brochures[index],
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.active !== undefined ? { active: payload.active } : {}),
        ...savedFile,
        updatedAt: new Date().toISOString()
      };
      if (db.brochures[index].active) {
        db.brochure = {
          fileName: db.brochures[index].fileName,
          path: db.brochures[index].path,
          updatedAt: db.brochures[index].updatedAt
        };
      }
      await writeDb(db);
      return sendJson(res, 200, db.brochures[index]);
    }

    if (url.pathname.startsWith("/api/brochures/") && req.method === "DELETE") {
      if (!requireAdmin(req, res)) return;
      const id = url.pathname.split("/").pop();
      db.brochures = db.brochures.filter((brochure) => brochure.id !== id);
      await writeDb(db);
      return sendJson(res, 200, { ok: true });
    }

    if (url.pathname === "/api/participants" && req.method === "GET") {
      if (!requireAdmin(req, res)) return;
      return sendJson(res, 200, db.participants);
    }

    if (url.pathname.startsWith("/api/participants")) {
      if (req.method !== "POST" && !requireAdmin(req, res)) return;
      return handleCollection(req, res, db, "participants", "participant", url.pathname);
    }

    if (url.pathname === "/api/sports" && req.method === "GET") {
      if (!requireAdmin(req, res)) return;
      return sendJson(res, 200, db.sports);
    }

    if (url.pathname.startsWith("/api/sports")) {
      if (!requireAdmin(req, res)) return;
      return handleCollection(req, res, db, "sports", "sport", url.pathname);
    }

    if (url.pathname === "/api/events" && req.method === "GET") {
      if (!requireAdmin(req, res)) return;
      return sendJson(res, 200, db.events);
    }

    if (url.pathname.startsWith("/api/events")) {
      if (!requireAdmin(req, res)) return;
      return handleCollection(req, res, db, "events", "event", url.pathname);
    }

    if (url.pathname === "/api/homepage" && req.method === "PUT") {
      if (!requireAdmin(req, res)) return;
      const payload = await readBody(req);
      db.homepage = { ...db.homepage, ...payload };
      await writeDb(db);
      return sendJson(res, 200, db.homepage);
    }

    if (url.pathname.startsWith("/api/sponsors")) {
      if (!requireAdmin(req, res)) return;
      return handleCollection(req, res, db, "sponsors", "sponsor", url.pathname);
    }

    if (url.pathname.startsWith("/api/testimonials")) {
      if (!requireAdmin(req, res)) return;
      return handleCollection(req, res, db, "testimonials", "testimonial", url.pathname);
    }

    if (url.pathname.startsWith("/api/categories")) {
      if (!requireAdmin(req, res)) return;
      return handleCollection(req, res, db, "categories", "category", url.pathname);
    }

    return sendError(res, 404, "Route not found");
  } catch (error) {
    return sendError(res, 500, error.message);
  }
}

const server = createServer(handleRequest);

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. The ATS backend may already be running.`);
    console.error(`Open http://127.0.0.1:${PORT}/api/public to check, or stop the old process and run npm run backend again.`);
    process.exit(1);
  }
  throw error;
});

server.listen(PORT, HOST, () => {
  console.log(`ATS backend running at http://${HOST}:${PORT}`);
});
