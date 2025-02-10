// server.js
import { readFile, writeFile } from "fs/promises";
import { createServer } from "http";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;
const DATA_FILE = path.join(__dirname, "data", "links.json");

const server = createServer(async (req, res) => {
    try {
        // Serve static files
        if (req.method === "GET") {
            if (req.url === "/") {
                return serveFile(res, path.join(__dirname, "public", "index.html"), "text/html");
            }
            if (req.url === "/urls") {
                const links = await loadLinks();
                res.writeHead(200, { "Content-Type": "application/json" });
                return res.end(JSON.stringify(links));
            }
            if (req.url?.startsWith("/s/")) {
                const code = req.url.split("/")[2];
                const links = await loadLinks();
                if (links[code]) {
                    res.writeHead(302, { Location: links[code] });
                    return res.end();
                }
                return serveFile(res, path.join(__dirname, "public", "404.html"), "text/html");
            }
            const filePath = path.join(__dirname, "public", req.url);
            return serveFile(res, filePath, getContentType(req.url));
        }

        // Handle URL shortening
        if (req.method === "POST" && req.url === "/shorten") {
            let body = "";
            for await (const chunk of req) body += chunk;
            
            const { url, shortCode } = JSON.parse(body);
            const links = await loadLinks();

            if (!isValidUrl(url)) {
                return sendError(res, 400, "Invalid URL format");
            }

            const finalCode = shortCode || crypto.randomBytes(4).toString("hex");
            if (!/^[a-zA-Z0-9_-]{4,20}$/.test(finalCode)) {
                return sendError(res, 400, "Invalid short code format");
            }

            if (links[finalCode]) {
                return sendError(res, 400, "Short code already exists");
            }

            links[finalCode] = url;
            await saveLinks(links);
            
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ shortCode: finalCode }));
        }

        res.writeHead(404);
        res.end("Not found");
    } catch (err) {
        console.error(err);
        res.writeHead(500);
        res.end("Internal server error");
    }
});

async function loadLinks() {
    try {
        const data = await readFile(DATA_FILE, "utf-8");
        return JSON.parse(data);
    } catch (err) {
        if (err.code === "ENOENT") {
            await writeFile(DATA_FILE, JSON.stringify({}));
            return {};
        }
        throw err;
    }
}

async function saveLinks(links) {
    await writeFile(DATA_FILE, JSON.stringify(links, null, 2));
}

function serveFile(res, filePath, contentType) {
    return readFile(filePath)
        .then(data => {
            res.writeHead(200, { "Content-Type": contentType });
            res.end(data);
        })
        .catch(err => {
            res.writeHead(404);
            res.end("Not found");
        });
}

function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

function sendError(res, code, message) {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: message }));
}

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));