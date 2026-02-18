const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const BASE_URL = "/textfile-api";
const STORAGE_PATH = path.join(__dirname, "storage");
const TEXT = { "Content-Type": "text/plain" };
const HTML = { "Content-Type": "text/html" };
const JSON_HEADER = { "Content-Type": "application/json" };

const sendOk = (res, message, contentType = TEXT) => {
    res.writeHead(200, contentType);
    res.end(message);
};

const sendBadRequest = (res, message) => {
    res.writeHead(400, TEXT);
    res.end(`Bad Request: ${message}`);
};

const sendNotFound = (res, message) => {
    res.writeHead(404, TEXT);
    res.end(`Not Found: ${message}`);
};

const sendServerError = (res, message) => {
    res.writeHead(500, TEXT);
    res.end(`Internal Server Error: ${message}`);
};

const sendMethodNotAllowed = (res, message) => {
    res.writeHead(405, TEXT);
    res.end(`Method Not Allowed: ${message}`);
};

const getFilepath = (filename) => {
    if (!filename) return null;
    const basename = path.basename(filename);
    const finalName = basename.toLowerCase().endsWith(".txt") ? basename : basename + ".txt";
    return path.join(STORAGE_PATH, finalName);
};

if (!fs.existsSync(STORAGE_PATH)) {
    fs.mkdirSync(STORAGE_PATH);
}

http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname.toLowerCase();

    if (pathname === "/organizer") {
        fs.readFile(path.join(__dirname, "index.html"), "utf8", (err, data) => {
            if (err) {
                if (err.code === "ENOENT") {
                    return sendNotFound(res, "Organizer page missing");
                }
                return sendServerError(res, "Failed to read file");
            }
            return sendOk(res, data, HTML);
        })
        return;
    }

    if (!pathname.startsWith(BASE_URL)) {
        return sendNotFound(res, "Route not found");
    }

    if (req.method !== "GET") {
        return sendMethodNotAllowed(res, "Only GET allowed");
    }

    const params = url.searchParams;
    const filename = params.get("filename")?.trim();
    const data = params.get("data");
    const filepath = getFilepath(filename);

    const route = pathname.slice(BASE_URL.length);

    switch (route) {
        case "/all":
            fs.readdir(STORAGE_PATH, (err, files) => {
                if (err) {
                    return sendServerError(res, "Cannot list files");
                }
                const txtFiles = files.filter((file) => file.endsWith(".txt"));
                sendOk(res, JSON.stringify(txtFiles), JSON_HEADER);
            });
            break;
        case "/new":
            if (!filename || data===null) {
                return sendBadRequest(res, "Missing data or filename");
            }

            fs.writeFile(filepath, data, (err) => {
                if (err) {
                    return sendServerError(res, "Failed to create file");
                }
                sendOk(res, "Successfully created file");
            });

            break;
        case "/read":
            if (!filename) {
                return sendBadRequest(res, `Missing file name`);
            }

            fs.readFile(filepath, "utf8", (err, data) => {
                if (err) {
                    if (err.code === "ENOENT") {
                        return sendNotFound(res, "File not found");
                    }
                    return sendServerError(res, "Failed to read file");
                }
                sendOk(res, data);
            });

            break;
        case "/remove":

            if (!filename) {
                return sendBadRequest(res, `Missing file name`);
            }

            fs.unlink(filepath, (err) => {
                if (err) {
                    if (err.code === "ENOENT") {
                        return sendNotFound(res, "File not found");
                    }
                    return sendServerError(res, "Failed to delete file");
                }
                sendOk(res, "Successfully deleted file");
            });

            break;
        case "/append":

            if (!filename || data===null) {
                return sendBadRequest(res, "Missing data or filename");
            }

            fs.access(filepath, (err) => {
                if (err) {
                    return sendNotFound(res, `File not found`);
                }

                fs.appendFile(filepath, data, (err) => {
                    if (err) {
                        return sendServerError(res, `Failed to append data to file`);
                    }
                    sendOk(res, `Successfully appended data to file`);
                });
            })
            break;
        default:
            sendNotFound(res, "Route not found");
    }

}).listen(PORT, () => console.log(`Running at http://localhost:${PORT}/organizer`));

