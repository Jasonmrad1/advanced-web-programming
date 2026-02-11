const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const BASE_URL = "/textfile-api";
const STORAGE_PATH = "./storage";
const TEXT = { "Content-Type": "text/plain" };

const sendOk = (res, message) => {
    res.writeHead(200, TEXT);
    res.end(`200 - OK - ${message}`);
};

const sendBadRequest = (res, message) => {
    res.writeHead(400, TEXT);
    res.end(`400 - Bad Request - ${message}`);
};

const sendNotFound = (res, message) => {
    res.writeHead(404, TEXT);
    res.end(`404 - Not Found - ${message}`);
};

const sendServerError = (res, message) => {
    res.writeHead(500, TEXT);
    res.end(`500 - Internal Server Error - ${message}`);
};

const sendMethodNotAllowed = (res, message) => {
    res.writeHead(405, TEXT);
    res.end(`405 - Method Not Allowed - ${message}`);
};

if(!fs.existsSync(STORAGE_PATH)){
    fs.mkdirSync(STORAGE_PATH);
}

http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname.toLowerCase();

    if(!pathname.startsWith(BASE_URL)){
    return sendNotFound(res, "Route not found");
    }
    
    const params = url.searchParams;     

    const filename =  params.get("filename");
    const data = params.get("data");
    const filepath = filename ? path.join(STORAGE_PATH, path.basename(filename.endsWith(".txt") ? filename : filename.concat(".txt"))) : null;

    if(req.method !== "GET"){
        return sendMethodNotAllowed(res, "Only GET allowed");
    }

    const route = pathname.slice(BASE_URL.length);

    switch(route){
        case "/all":
                fs.readdir(STORAGE_PATH, (err, files) => {
                    if(err){
                        return sendServerError(res, "Cannot list files");
                    }
                    const txtFiles = files.filter((file) => file.endsWith(".txt"));
                    return sendOk(res, txtFiles.toString());
                });
        break;
        case "/new":
                if(!filename || !data){
                    return sendBadRequest(res, "Missing data or filename");
                }
                
                fs.writeFile(filepath, data, (err) =>{
                    if(err){
                        return sendServerError(res, `Cannot create file at ${filepath}`);
                    }
                    sendOk(res, `Successfully created file at ${filepath}`);                
                });

        break;
        case "/read":
                if(!filename){
                    return sendBadRequest(res, `Missing file name`);
                }

                fs.readFile(filepath, "utf8", (err, data) => {
                    if(err){
                        if(err.code == "ENOENT"){
                            return sendNotFound(res, `Failed to read file at ${filepath}`);
                        }
                        return sendServerError(res, `Failed to read file at ${filepath}`);
                    }
                    sendOk(res, data);
                });
                
        break;
        case "/remove":
            
            if(!filename){
                return sendBadRequest(res, `Missing file name`);
            }

            fs.unlink(filepath, (err) => {
                if(err){
                    if(err.code == "ENOENT"){
                        return sendNotFound(res, `Failed to delete file at ${filepath}`);
                    }
                    return sendServerError(res, `Failed to delete file at ${filepath}`);
                 }
                sendOk(res, `Successfully deleted file at ${filepath}`);
            });
            
            break;
        case '/append':

            if(!filename || !data){
                return sendBadRequest(res, "Missing data or filename");
            }

            fs.appendFile(filepath, data, (err) => {
                if(err){
                    if(err.code == "ENOENT"){
                        return sendNotFound(res, `Failed to append data to file at ${filepath}`);
                    }
                    return sendServerError(res, `Failed to append data to file at ${filepath}`);
                }
                sendOk(res, `Successfully appended data to file at ${filepath}`);
            });
            break;
        default:
            sendNotFound(res, "Route not found");        
    }
    
}).listen(PORT, () => console.log(`Running at http://localhost:${PORT}`));

