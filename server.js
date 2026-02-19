const http = require("http");
const fs = require("fs");
const path = require("path");
// For security, we use a library to sanitize file names
// that removes  dangerous chars to prevent directory traversal attacks(malicious input)
const sanitize = require("sanitize-filename");

const PORT = 3000;
const BASE_URL = "/textfile-api"; //groupe API routes under this base URL
//Folder to store text files used join to create path that works across OS
const STORAGE_PATH = path.join(__dirname, "storage");

//headers
const TEXT = { "Content-Type": "text/plain" };
const HTML = { "Content-Type": "text/html" };
const JSON_HEADER = { "Content-Type": "application/json" };

//Helper functions to send responses with appropriate status codes and messages
//200 OK
const sendOk = (res, message, contentType = TEXT) => {
    res.writeHead(200, contentType);
    res.end(message);
};
//400 Bad Request
const sendBadRequest = (res, message) => {
    res.writeHead(400, TEXT);
    res.end(`Bad Request: ${message}`);
};
//404 Not Found
const sendNotFound = (res, message) => {
    res.writeHead(404, TEXT);
    res.end(`Not Found: ${message}`);
};
//500 Internal Server Error
const sendServerError = (res, message) => {
    res.writeHead(500, TEXT);
    res.end(`Internal Server Error: ${message}`);
};
//405 Method Not Allowed
const sendMethodNotAllowed = (res, message) => {
    res.writeHead(405, TEXT);
    res.end(`Method Not Allowed: ${message}`);
};

//Function to get the full file path for a given filename after sanitization
const getFilepath = (filename) => {
    if (!filename) return null;
    const sanitized = sanitize(filename);//remove illegal OS char (and prevent directory traversal like "../../secret.txt")
    if (!sanitized) return null;
    //path.parse extract the name without the extension and we add .txt
    const finalName = path.parse(sanitized).name + '.txt';
    return path.join(STORAGE_PATH, finalName);
};

//Ensure the storage directory exists, if not create it
if (!fs.existsSync(STORAGE_PATH)) {
    fs.mkdirSync(STORAGE_PATH);
}


//Request logic handling different routes and methods
http.createServer((req, res) => {//call back function for every incoming request

    //Parse URL to extract the pathname and query parameters
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname.toLowerCase();

    //organizer page route
    if (pathname === "/organizer") {
        fs.readFile(path.join(__dirname, "index.html"), "utf8", (err, data) => {
            if (err) {
                if (err.code === "ENOENT") {
                    return sendNotFound(res, "Organizer page missing");
                }
                return sendServerError(res, "Failed to read file");
            }
            return sendOk(res, data, HTML);
        });
        return;
    }

    //All API routes should start with BASE_URL
    if (!pathname.startsWith(BASE_URL)) {
        return sendNotFound(res, "Route not found");
    }

    //GET is the only method used
    if (req.method !== "GET") {
        return sendMethodNotAllowed(res, "Only GET allowed");
    }

    //Extract filename and data from the query string
    const params = url.searchParams;
    const filename = params.get("filename")?.trim();//trim remove extra spaces
    const data = params.get("data");
    const filepath = getFilepath(filename);//call helper function to get the full path of the file after sanitization

    const route = pathname.slice(BASE_URL.length);

    switch (route) {
        case "/all":
            fs.readdir(STORAGE_PATH, (err, files) => {
                if (err) {
                    return sendServerError(res, "Cannot list files");
                }
                //Filter only .txt files and send as JSON array
                //if someone creates a non .txt file manually in the storage folder
                const txtFiles = files.filter((file) => file.endsWith(".txt"));
                sendOk(res, JSON.stringify(txtFiles), JSON_HEADER); 
            });
            
            break;

        case "/new":
            //filename is required to create a new file
            if (!filename) {
                return sendBadRequest(res, "Missing file name");
            }
            //if the filename is invalid after sanitization, filepath will be null
            if (!filepath) {
                return sendBadRequest(res, "Invalid file name");
            }
            //data is optional, if not provided we create an empty file
            fs.writeFile(filepath, data, (err) => {
                if (err) {
                    return sendServerError(res, "Failed to create file");
                }
                sendOk(res, "Successfully created file");
            });

            break;

        case "/read":
            if (!filename) {
                return sendBadRequest(res, "Missing file name");
            }
            
            if (!filepath) {
                return sendBadRequest(res, "Invalid file name");
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
                return sendBadRequest(res, "Missing file name");
            }
            
            if (!filepath) {
                return sendBadRequest(res, "Invalid file name");
            }

            fs.unlink(filepath, (err) => { //unlink delete the file at the given path
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
            //both filename and data are required to append to a file
            if (!filename || !data) {
                return sendBadRequest(res, "Missing data or filename");
            }

            if (!filepath) {
                return sendBadRequest(res, "Invalid file name");
            }
            //Check if the file exists before trying to append to it
            fs.access(filepath, (err) => {
                if (err) {
                    if (err.code === "ENOENT") {
                        return sendNotFound(res, "File not found");
                    }
                    return sendServerError(res, "Failed to access file");
                }
                //Append data to the file, if the file doesn't exist it will return an error
                fs.appendFile(filepath, data, (err) => {
                    if (err) {
                        return sendServerError(res, "Failed to append data to file");
                    }
                    sendOk(res, "Successfully appended data to file");
                });
            });

            break;
        
        //If none of the above routes match return a 404 Not Found response
        default:
            sendNotFound(res, "Route not found");
    }
    //Start the server and listen on the specified port, log a message to the console when the server is ready
}).listen(PORT, () => console.log(`Running at http://localhost:${PORT}/organizer`));


